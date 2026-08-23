import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EfiPixService, type EfiPayerInput } from './efi-pix.service';
import { MercadoPagoService, type MercadoPagoPayerInput } from './mercado-pago.service';
import {
  PaymentProviderConfigService,
  type PaymentProviderCode,
  type PaymentType,
} from './payment-provider-config.service';

export interface PaymentCheckoutPayer extends EfiPayerInput, MercadoPagoPayerInput {}

@Injectable()
export class PaymentProviderManagerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly providerConfig: PaymentProviderConfigService,
    private readonly efi: EfiPixService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  list() {
    return this.providerConfig.listSafe();
  }

  routes() {
    return this.providerConfig.listRoutesSafe();
  }

  publicRoutes() {
    return this.providerConfig.publicRoutes();
  }

  get(code: string) {
    return this.providerConfig.getSafe(code);
  }

  save(code: string, body: Record<string, unknown>, adminUserId: string) {
    return this.providerConfig.saveConfig(code, body, adminUserId);
  }

  vaultStatus() {
    return this.providerConfig.vaultStatus();
  }

  private adapter(code: PaymentProviderCode) {
    if (code === 'EFI') return this.efi;
    if (code === 'MERCADO_PAGO') return this.mercadoPago;
    throw new BadRequestException('Forma de pagamento não suportada.');
  }

  async test(codeInput: string, adminUserId?: string) {
    const code = this.providerConfig.normalizeCode(codeInput);
    try {
      const adapter: any = this.adapter(code);
      const result = await adapter.healthCheck();
      return this.providerConfig.recordHealth(
        code,
        result?.operational === true,
        String(result?.message || 'Teste concluído.'),
        result?.details || {},
        adminUserId,
      );
    } catch (error: any) {
      const message = error?.response?.message
        || error?.response?.data?.message
        || error?.message
        || 'A API não respondeu ao teste operacional.';
      return this.providerConfig.recordHealth(
        code,
        false,
        String(message).slice(0, 2000),
        {},
        adminUserId,
      );
    }
  }

  async activate(codeInput: string, paymentTypeInput: string, adminUserId: string) {
    const code = this.providerConfig.normalizeCode(codeInput);
    const paymentType = this.providerConfig.normalizePaymentType(paymentTypeInput);
    const tested = await this.test(code, adminUserId);
    if (tested.lastHealthCheckOk !== true) {
      throw new BadRequestException(
        tested.lastHealthCheckMessage || 'A forma de pagamento não passou pelo teste operacional.',
      );
    }

    if (code === 'EFI') {
      try {
        await this.efi.configureWebhooks(paymentType);
      } catch (error: any) {
        const responseMessage = error?.response?.message;
        const message = typeof responseMessage === 'string'
          ? responseMessage
          : error?.message || 'A Efí respondeu, mas o Webhook não pôde ser registrado.';
        await this.providerConfig.recordHealth(
          code,
          false,
          String(message),
          { stage: 'WEBHOOK_CONFIGURATION', paymentType },
          adminUserId,
        );
        throw new BadRequestException(`Efí não habilitada para ${paymentType === 'PIX' ? 'Pix avulso' : 'Pix Automático'}: ${message}`);
      }
    }

    const routes = await this.providerConfig.activateRoute(code, paymentType, adminUserId);
    return { provider: await this.providerConfig.getSafe(code), routes };
  }

  deactivate(paymentType: string, adminUserId: string) {
    return this.providerConfig.deactivateRoute(paymentType, adminUserId);
  }

  async createCheckout(
    payment: any,
    payerInput: PaymentCheckoutPayer = {},
  ) {
    const paymentType: PaymentType = payment.product?.billingType === 'RECURRING'
      ? 'PIX_AUTOMATICO'
      : 'PIX';
    const active = await this.providerConfig.activeProvider(paymentType);
    if (!active) {
      throw new ServiceUnavailableException(
        paymentType === 'PIX_AUTOMATICO'
          ? 'Nenhum provedor está habilitado para Pix Automático. Configure a rota em Formas de pagamento.'
          : 'Nenhum provedor está habilitado para Pix. Configure a rota em Formas de pagamento.',
      );
    }

    const userRows = await this.dataSource.query(
      `SELECT email, "fullName", "displayName" FROM users WHERE id = $1 LIMIT 1`,
      [payment.userId],
    );
    const user = userRows[0] || {};
    const payer = {
      ...payerInput,
      email: String(payerInput.email || user.email || '').trim(),
      name: String(payerInput.name || user.fullName || user.displayName || '').trim(),
    };

    if (active === 'EFI') {
      return paymentType === 'PIX_AUTOMATICO'
        ? this.efi.createMonthlyAutomaticCharge(
            Number(payment.amountCents),
            payment.id,
            payment.product?.name || payment.productCode,
            payer,
          )
        : this.efi.createImmediateCharge(
            Number(payment.amountCents),
            payment.id,
            payment.product?.name || payment.productCode,
          );
    }

    if (active === 'MERCADO_PAGO') {
      return paymentType === 'PIX_AUTOMATICO'
        ? this.mercadoPago.createRecurringCheckout(
            Number(payment.amountCents),
            payment.id,
            payment.product?.name || payment.productCode,
            payer,
          )
        : this.mercadoPago.createImmediateCharge(
            Number(payment.amountCents),
            payment.id,
            payment.product?.name || payment.productCode,
            payer,
          );
    }

    throw new ServiceUnavailableException('A forma de pagamento selecionada não possui adapter carregado.');
  }
}
