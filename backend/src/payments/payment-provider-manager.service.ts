import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EfiPixService, type EfiPayerInput } from './efi-pix.service';
import { MercadoPagoService, type MercadoPagoPayerInput } from './mercado-pago.service';
import {
  PaymentProviderConfigService,
  type PaymentProviderCode,
  type PaymentType,
} from './payment-provider-config.service';

export interface PaymentCheckoutPayer extends EfiPayerInput, MercadoPagoPayerInput {
  documentType?: 'CPF' | 'CNPJ';
}

@Injectable()
export class PaymentProviderManagerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly providerConfig: PaymentProviderConfigService,
    private readonly efi: EfiPixService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  private isNativeAutomaticPixProvider(code: PaymentProviderCode | null | undefined) {
    return code === 'EFI';
  }

  async list() {
    const providers = await this.providerConfig.listSafe();
    return providers.map((provider: any) => {
      if (provider.code !== 'MERCADO_PAGO') return provider;
      return {
        ...provider,
        activeFor: Array.isArray(provider.activeFor)
          ? provider.activeFor.filter((type: string) => type !== 'PIX_AUTOMATICO')
          : [],
        config: {
          ...(provider.config || {}),
          capabilities: Array.isArray(provider.config?.capabilities)
            ? provider.config.capabilities.filter((type: string) => type !== 'PIX_AUTOMATICO')
            : ['PIX'],
          recurringApi: 'SUBSCRIPTIONS',
          recurringIsPixAutomatic: false,
        },
      };
    });
  }

  async routes() {
    const routes = await this.providerConfig.listRoutesSafe();
    return routes.map((route: any) => {
      if (
        route.paymentType === 'PIX_AUTOMATICO'
        && route.enabled === true
        && route.providerCode
        && !this.isNativeAutomaticPixProvider(route.providerCode)
      ) {
        return {
          ...route,
          enabled: false,
          providerCode: null,
          providerName: null,
          invalidLegacyRoute: true,
          message: 'A rota antiga apontava para uma assinatura do Mercado Pago, não para Pix Automático nativo.',
        };
      }
      return route;
    });
  }

  async publicRoutes() {
    const routes = await this.routes();
    return routes.reduce((result: Record<string, any>, route: any) => {
      result[route.paymentType] = route.enabled && route.providerCode
        ? { available: true, code: route.providerCode, name: route.providerName }
        : {
            available: false,
            code: null,
            name: null,
            reason: route.invalidLegacyRoute ? 'INVALID_LEGACY_ROUTE' : null,
          };
      return result;
    }, {});
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

    if (paymentType === 'PIX_AUTOMATICO' && !this.isNativeAutomaticPixProvider(code)) {
      throw new BadRequestException(
        'Mercado Pago Assinaturas não é Pix Automático. Para a rota Pix Automático, selecione uma integração nativa compatível, atualmente Efí Bank.',
      );
    }

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
    options: { trialDays?: number } = {},
  ) {
    const trialDays = Math.max(0, Math.min(30, Math.round(Number(options.trialDays || 0))));
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

    if (paymentType === 'PIX_AUTOMATICO' && !this.isNativeAutomaticPixProvider(active)) {
      throw new ServiceUnavailableException(
        'A rota de Pix Automático está apontando para uma integração de assinatura que não gera Pix Automático nativo. Selecione Efí Bank em Formas de pagamento.',
      );
    }

    const userRows = await this.dataSource.query(
      `SELECT email, "fullName", "displayName" FROM users WHERE id = $1 LIMIT 1`,
      [payment.userId],
    );
    const user = userRows[0] || {};
    const document = String(payerInput.document || '').replace(/\D/g, '');
    const requestedType = String(payerInput.documentType || '').toUpperCase();
    const documentType: 'CPF' | 'CNPJ' = requestedType === 'CNPJ' || (!requestedType && document.length === 14)
      ? 'CNPJ'
      : 'CPF';

    if (document && ((documentType === 'CPF' && document.length !== 11) || (documentType === 'CNPJ' && document.length !== 14))) {
      throw new BadRequestException(`Informe um ${documentType} válido.`);
    }

    const payer: PaymentCheckoutPayer = {
      ...payerInput,
      document: document || undefined,
      documentType,
      email: String(payerInput.email || user.email || '').trim(),
      name: String(payerInput.name || user.fullName || user.displayName || '').trim(),
    };

    if (active === 'EFI') {
      if (paymentType === 'PIX_AUTOMATICO' && payer.documentType === 'CNPJ') {
        throw new BadRequestException(
          'A rota atual de Pix Automático está usando Efí e este fluxo está configurado para CPF. Informe um CPF para a autorização recorrente.',
        );
      }
      return paymentType === 'PIX_AUTOMATICO'
        ? this.efi.createMonthlyAutomaticCharge(
            Number(payment.amountCents),
            payment.id,
            payment.product?.name || payment.productCode,
            payer,
            trialDays,
          )
        : this.efi.createImmediateCharge(
            Number(payment.amountCents),
            payment.id,
            payment.product?.name || payment.productCode,
          );
    }

    if (active === 'MERCADO_PAGO') {
      if (paymentType === 'PIX_AUTOMATICO') {
        throw new ServiceUnavailableException(
          'Mercado Pago Assinaturas não será usado como substituto de Pix Automático.',
        );
      }
      return this.mercadoPago.createImmediateCharge(
        Number(payment.amountCents),
        payment.id,
        payment.product?.name || payment.productCode,
        payer,
      );
    }

    throw new ServiceUnavailableException('A forma de pagamento selecionada não possui adapter carregado.');
  }
}
