import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import {
  PaymentProviderConfigService,
  type MercadoPagoProviderConfig,
} from './payment-provider-config.service';

export interface MercadoPagoPayerInput {
  name?: string;
  document?: string;
  email?: string;
}

@Injectable()
export class MercadoPagoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
    private readonly providerConfig: PaymentProviderConfigService,
  ) {}

  private async config() {
    return this.providerConfig.getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO');
  }

  private async sdk(): Promise<any> {
    try {
      const importer = new Function('moduleName', 'return import(moduleName)') as (moduleName: string) => Promise<any>;
      return await importer('mercadopago');
    } catch {
      throw new ServiceUnavailableException(
        'SDK Mercado Pago não instalado. Execute npm install no backend após atualizar o projeto.',
      );
    }
  }

  private assertConfigured(config: MercadoPagoProviderConfig) {
    const missing: string[] = [];
    if (!config.accessToken) missing.push('Access Token');
    if (!config.publicApiBaseUrl) missing.push('URL pública da API');
    if (!config.webhookSecret) missing.push('Assinatura secreta do Webhook');
    if (missing.length) {
      throw new ServiceUnavailableException(`Mercado Pago não configurado: faltando ${missing.join(', ')}.`);
    }
  }

  private client(sdk: any, config: MercadoPagoProviderConfig) {
    if (!sdk?.MercadoPagoConfig) throw new ServiceUnavailableException('SDK Mercado Pago incompatível com esta integração.');
    return new sdk.MercadoPagoConfig({
      accessToken: String(config.accessToken),
      options: { timeout: 15000 },
    });
  }

  private webhookUrl(config: MercadoPagoProviderConfig) {
    const base = String(config.publicApiBaseUrl || '').trim().replace(/\/$/, '');
    if (!base) throw new ServiceUnavailableException('Informe a URL pública da API para receber Webhooks do Mercado Pago.');
    return `${base}/payments/webhooks/mercado-pago`;
  }

  async healthCheck() {
    const config = await this.config();
    this.assertConfigured(config);
    const sdk = await this.sdk();
    this.client(sdk, config);
    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${String(config.accessToken)}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ServiceUnavailableException(`Mercado Pago recusou as credenciais (${response.status}). ${body.slice(0, 300)}`);
    }
    const me: any = await response.json().catch(() => ({}));
    return {
      operational: true,
      message: 'Mercado Pago respondeu com credenciais válidas e o SDK oficial está disponível.',
      details: {
        userId: me?.id || null,
        nickname: me?.nickname || null,
        webhookUrl: this.webhookUrl(config),
        sdk: 'mercadopago',
        capabilities: ['PIX'],
      },
    };
  }

  async createImmediateCharge(
    amountCents: number,
    paymentId: string,
    productName: string,
    payer: MercadoPagoPayerInput,
  ) {
    const config = await this.config();
    this.assertConfigured(config);
    const email = String(payer.email || '').trim();
    const document = String(payer.document || '').replace(/\D/g, '');
    if (!email || !email.includes('@')) {
      throw new BadRequestException('O Mercado Pago exige o e-mail do pagador para gerar o Pix.');
    }
    if (document.length !== 11) {
      throw new BadRequestException('O Mercado Pago exige um CPF válido para gerar o Pix.');
    }

    const sdk = await this.sdk();
    const Payment = sdk?.Payment;
    if (!Payment) throw new ServiceUnavailableException('Classe Payment não encontrada no SDK Mercado Pago.');
    const paymentClient = new Payment(this.client(sdk, config));
    const response: any = await paymentClient.create({
      body: {
        transaction_amount: Math.max(0, Math.round(amountCents)) / 100,
        description: String(productName || 'PiraNegócios').slice(0, 220),
        payment_method_id: 'pix',
        external_reference: paymentId,
        notification_url: this.webhookUrl(config),
        payer: {
          email,
          identification: { type: 'CPF', number: document },
        },
      },
      requestOptions: { idempotencyKey: paymentId },
    });

    const providerPaymentId = String(response?.id || '').trim();
    if (!providerPaymentId) throw new ServiceUnavailableException('O Mercado Pago não retornou o ID do pagamento.');
    const transactionData = response?.point_of_interaction?.transaction_data || {};
    return {
      provider: 'MERCADO_PAGO',
      providerPaymentId,
      pixCopyPaste: transactionData.qr_code || null,
      qrCodeBase64: transactionData.qr_code_base64 || null,
      expiresAt: response?.date_of_expiration || null,
      metadata: {
        mercadoPagoStatus: response?.status || null,
        mercadoPagoStatusDetail: response?.status_detail || null,
        ticketUrl: transactionData.ticket_url || null,
        externalReference: paymentId,
      },
    };
  }

  async createRecurringCheckout() {
    throw new ServiceUnavailableException(
      'Neste adapter, o Mercado Pago está habilitado para Pix avulso. Para o Plano Destaque mensal com Pix Automático, use a Efí Bank.',
    );
  }

  private async validateSignature(
    config: MercadoPagoProviderConfig,
    xSignature?: string,
    xRequestId?: string,
    dataId?: string,
  ) {
    const secret = String(config.webhookSecret || '');
    if (!secret) throw new UnauthorizedException('Assinatura secreta do Webhook Mercado Pago não configurada.');
    if (!xSignature || !xRequestId || !dataId) throw new UnauthorizedException('Webhook Mercado Pago sem assinatura completa.');
    const sdk = await this.sdk();
    try {
      sdk.WebhookSignatureValidator.validate({
        xSignature,
        xRequestId,
        dataId,
        secret,
      });
    } catch {
      throw new UnauthorizedException('Assinatura do Webhook Mercado Pago inválida.');
    }
  }

  async handleWebhook(
    body: any,
    query: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const config = await this.config();
    const dataId = String(query?.['data.id'] || body?.data?.id || '').trim();
    await this.validateSignature(
      config,
      String(headers['x-signature'] || ''),
      String(headers['x-request-id'] || ''),
      dataId,
    );

    const type = String(query?.type || body?.type || '').toLowerCase();
    if (!dataId || !['payment', 'payments'].includes(type)) {
      return { ok: true, ignored: true, type, dataId };
    }

    const sdk = await this.sdk();
    const Payment = sdk?.Payment;
    if (!Payment) throw new ServiceUnavailableException('Classe Payment não encontrada no SDK Mercado Pago.');
    const detail: any = await new Payment(this.client(sdk, config)).get({ id: dataId });
    const localId = String(detail?.external_reference || '').trim();
    let rows: any[] = [];
    if (localId) {
      rows = await this.dataSource.query(
        `SELECT * FROM payments WHERE id = $1 AND provider = 'MERCADO_PAGO' LIMIT 1`,
        [localId],
      );
    }
    if (!rows[0]) {
      rows = await this.dataSource.query(
        `SELECT * FROM payments WHERE provider = 'MERCADO_PAGO' AND "providerPaymentId" = $1 LIMIT 1`,
        [dataId],
      );
    }
    const payment = rows[0];
    if (!payment) return { ok: true, ignored: true, reason: 'payment_not_found', dataId };

    const paidCents = Math.round(Number(detail?.transaction_amount || 0) * 100);
    if (paidCents !== Number(payment.amountCents)) {
      return { ok: true, ignored: true, reason: 'amount_mismatch', dataId };
    }
    const status = String(detail?.status || '').toLowerCase();
    if (status !== 'approved') {
      await this.dataSource.query(
        `UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`,
        [payment.id, JSON.stringify({ mercadoPagoStatus: status, mercadoPagoStatusDetail: detail?.status_detail || null })],
      );
      return { ok: true, paymentId: payment.id, status };
    }

    const settled = await this.payments.confirmProviderPayment(payment.id, {
      provider: 'MERCADO_PAGO',
      mercadoPagoPaymentId: dataId,
      mercadoPagoStatus: status,
      confirmationMode: 'MERCADO_PAGO_WEBHOOK',
    });
    return { ok: true, paymentId: payment.id, status: settled.status };
  }
}
