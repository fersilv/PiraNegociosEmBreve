import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { PaymentProviderVaultService } from './payment-provider-vault.service';

type TestProfileCode = 'ORDERS' | 'SUBSCRIPTIONS' | 'MARKETPLACE';

type TestProfileConfig = {
  applicationId?: string;
  publicKey?: string;
  accessToken?: string;
  sellerAccessToken?: string;
  payerEmail?: string;
};

@Injectable()
export class MercadoPagoTestLabService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly vault: PaymentProviderVaultService,
  ) {}

  async overview() {
    const rows = await this.dataSource.query(
      `SELECT "profileCode","encryptedConfig","updatedAt"
       FROM payment_provider_test_profiles
       WHERE "providerCode"='MERCADO_PAGO'`,
    );
    const profiles: Record<string, any> = {};
    for (const row of rows) {
      const config = this.vault.decrypt<TestProfileConfig>(row.encryptedConfig);
      profiles[row.profileCode] = this.safeProfile(row.profileCode, config, row.updatedAt);
    }
    for (const profile of ['ORDERS','SUBSCRIPTIONS','MARKETPLACE'] as TestProfileCode[]) {
      if (!profiles[profile]) profiles[profile] = this.safeProfile(profile, {}, null);
    }
    const history = await this.history();
    return {
      provider: 'MERCADO_PAGO',
      environment: 'TEST',
      productionCredentialsUntouched: true,
      profiles,
      history,
      vault: this.vault.status(),
    };
  }

  async saveProfile(profileInput: string, input: Record<string, unknown>, adminUserId: string) {
    const profile = this.profile(profileInput);
    const current = await this.secretProfile(profile).catch(() => ({} as TestProfileConfig));
    const next: TestProfileConfig = {
      applicationId: this.text(input.applicationId, 80) ?? current.applicationId ?? '',
      publicKey: this.text(input.publicKey, 1200) ?? current.publicKey ?? '',
      accessToken: this.text(input.accessToken, 2600) ?? current.accessToken ?? '',
      sellerAccessToken: profile === 'MARKETPLACE'
        ? this.text(input.sellerAccessToken, 2600) ?? current.sellerAccessToken ?? ''
        : '',
      payerEmail: this.email(input.payerEmail, current.payerEmail),
    };
    if (input.removeAccessToken === true) next.accessToken = '';
    if (input.removePublicKey === true) next.publicKey = '';
    if (input.removeSellerAccessToken === true) next.sellerAccessToken = '';

    await this.dataSource.query(
      `INSERT INTO payment_provider_test_profiles
        ("providerCode","profileCode","encryptedConfig","updatedBy","createdAt","updatedAt")
       VALUES ('MERCADO_PAGO',$1,$2,$3,now(),now())
       ON CONFLICT ("providerCode","profileCode") DO UPDATE SET
         "encryptedConfig"=EXCLUDED."encryptedConfig", "updatedBy"=EXCLUDED."updatedBy", "updatedAt"=now()`,
      [profile, this.vault.encrypt(next), adminUserId],
    );
    return this.safeProfile(profile, next, new Date().toISOString());
  }

  async testCredentials(profileInput: string, adminUserId: string) {
    const profile = this.profile(profileInput);
    const config = await this.secretProfile(profile);
    const token = this.tokenForProfile(profile, config);
    try {
      const me = await this.request(token, 'GET', '/users/me');
      await this.record(profile, 'CREDENTIALS_CHECK', true, String(me?.id || ''), {
        nickname: me?.nickname || null,
        applicationId: config.applicationId || null,
      }, adminUserId);
      return {
        ok: true,
        profile,
        userId: me?.id || null,
        nickname: me?.nickname || null,
        applicationId: config.applicationId || null,
      };
    } catch (error) {
      await this.record(profile, 'CREDENTIALS_CHECK', false, null, { error: this.errorMessage(error) }, adminUserId);
      throw error;
    }
  }

  async createOrder(adminUserId: string) {
    const profile: TestProfileCode = 'ORDERS';
    const config = await this.secretProfile(profile);
    const token = this.required(config.accessToken, 'Cadastre o Access Token de teste da aplicação Orders.');
    const payerEmail = config.payerEmail || 'test_user_br@testuser.com';
    const externalReference = `pn-test-order-${Date.now()}`;
    const idempotency = randomUUID();
    try {
      const order = await this.request(token, 'POST', '/v1/orders', {
        type: 'online',
        external_reference: externalReference,
        total_amount: '50.00',
        processing_mode: 'automatic',
        transactions: {
          payments: [{
            amount: '50.00',
            payment_method: { id: 'pix', type: 'bank_transfer' },
            expiration_time: 'PT1H',
          }],
        },
        payer: { email: payerEmail },
      }, idempotency);
      const id = String(order?.id || '').trim();
      if (!id) throw new ServiceUnavailableException('O Mercado Pago criou a resposta sem retornar o Order ID.');
      const transaction = Array.isArray(order?.transactions?.payments) ? order.transactions.payments[0] || {} : {};
      await this.record(profile, 'ORDER_PIX_CREATED', true, id, {
        status: order?.status || null,
        transactionId: transaction?.id || null,
        transactionStatus: transaction?.status || null,
        externalReference,
        amount: '50.00',
      }, adminUserId);
      return {
        ok: true,
        profile,
        orderId: id,
        transactionId: transaction?.id || null,
        status: order?.status || null,
        transactionStatus: transaction?.status || null,
        externalReference,
        amount: '50.00',
        payerEmail,
      };
    } catch (error) {
      await this.record(profile, 'ORDER_PIX_CREATED', false, null, { error: this.errorMessage(error) }, adminUserId);
      throw error;
    }
  }

  async getOrder(orderIdInput: string, adminUserId: string) {
    const profile: TestProfileCode = 'ORDERS';
    const orderId = this.required(orderIdInput, 'Informe o Order ID.');
    const config = await this.secretProfile(profile);
    const token = this.required(config.accessToken, 'Cadastre o Access Token de teste da aplicação Orders.');
    const order = await this.request(token, 'GET', `/v1/orders/${encodeURIComponent(orderId)}`);
    const transaction = Array.isArray(order?.transactions?.payments) ? order.transactions.payments[0] || {} : {};
    await this.record(profile, 'ORDER_FETCHED', true, orderId, {
      status: order?.status || null,
      transactionStatus: transaction?.status || null,
    }, adminUserId);
    return {
      orderId,
      status: order?.status || null,
      totalAmount: order?.total_amount || null,
      externalReference: order?.external_reference || null,
      transactionId: transaction?.id || null,
      transactionStatus: transaction?.status || null,
      transactionStatusDetail: transaction?.status_detail || null,
    };
  }

  async createSubscription(adminUserId: string) {
    const profile: TestProfileCode = 'SUBSCRIPTIONS';
    const config = await this.secretProfile(profile);
    const token = this.required(config.accessToken, 'Cadastre o Access Token de teste da aplicação de Assinaturas.');
    const payerEmail = this.required(config.payerEmail, 'Informe o e-mail do usuário de teste que fará a assinatura.');
    const externalReference = `pn-test-sub-${Date.now()}`;
    try {
      const subscription = await this.request(token, 'POST', '/preapproval', {
        reason: 'PiraNegócios Plus - teste de integração',
        external_reference: externalReference,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 10,
          currency_id: 'BRL',
        },
        back_url: 'https://piranegocios.com.br/admin/pagamentos/testes',
        status: 'pending',
      }, `pn-sub-${randomUUID()}`);
      const id = String(subscription?.id || '').trim();
      if (!id) throw new ServiceUnavailableException('O Mercado Pago não retornou o Preapproval ID.');
      await this.record(profile, 'PREAPPROVAL_CREATED', true, id, {
        status: subscription?.status || null,
        externalReference,
        initPoint: subscription?.init_point || null,
      }, adminUserId);
      return {
        ok: true,
        profile,
        preapprovalId: id,
        status: subscription?.status || null,
        initPoint: subscription?.init_point || null,
        externalReference,
        payerEmail,
      };
    } catch (error) {
      await this.record(profile, 'PREAPPROVAL_CREATED', false, null, { error: this.errorMessage(error) }, adminUserId);
      throw error;
    }
  }

  async getSubscription(preapprovalIdInput: string, adminUserId: string) {
    const profile: TestProfileCode = 'SUBSCRIPTIONS';
    const preapprovalId = this.required(preapprovalIdInput, 'Informe o Preapproval ID.');
    const config = await this.secretProfile(profile);
    const token = this.required(config.accessToken, 'Cadastre o Access Token de teste da aplicação de Assinaturas.');
    const subscription = await this.request(token, 'GET', `/preapproval/${encodeURIComponent(preapprovalId)}`);
    await this.record(profile, 'PREAPPROVAL_FETCHED', true, preapprovalId, {
      status: subscription?.status || null,
      nextPaymentDate: subscription?.next_payment_date || null,
    }, adminUserId);
    return {
      preapprovalId,
      status: subscription?.status || null,
      payerEmail: subscription?.payer_email || null,
      nextPaymentDate: subscription?.next_payment_date || null,
      externalReference: subscription?.external_reference || null,
      initPoint: subscription?.init_point || null,
    };
  }

  async createMarketplaceSplit(adminUserId: string) {
    const profile: TestProfileCode = 'MARKETPLACE';
    const config = await this.secretProfile(profile);
    const sellerToken = this.required(
      config.sellerAccessToken || config.accessToken,
      'Informe o Access Token OAuth do vendedor de teste do Marketplace.',
    );
    const payerEmail = this.required(config.payerEmail, 'Informe o e-mail do comprador de teste.');
    const idempotency = randomUUID();
    const externalReference = `pn-test-split-${Date.now()}`;
    try {
      const payment = await this.request(sellerToken, 'POST', '/v1/payments', {
        transaction_amount: 25,
        application_fee: 0.25,
        description: 'PiraNegócios Marketplace - teste split 1:1',
        external_reference: externalReference,
        payment_method_id: 'pix',
        payer: { email: payerEmail },
      }, idempotency);
      const id = String(payment?.id || '').trim();
      if (!id) throw new ServiceUnavailableException('O Mercado Pago não retornou o Payment ID do teste de split.');
      await this.record(profile, 'SPLIT_PIX_CREATED', true, id, {
        status: payment?.status || null,
        statusDetail: payment?.status_detail || null,
        transactionAmount: 25,
        applicationFee: 0.25,
        externalReference,
      }, adminUserId);
      return {
        ok: true,
        profile,
        paymentId: id,
        status: payment?.status || null,
        statusDetail: payment?.status_detail || null,
        externalReference,
        transactionAmount: 25,
        intermediationFee: 0.25,
        payerEmail,
      };
    } catch (error) {
      await this.record(profile, 'SPLIT_PIX_CREATED', false, null, { error: this.errorMessage(error) }, adminUserId);
      throw error;
    }
  }

  async getMarketplacePayment(paymentIdInput: string, adminUserId: string) {
    const profile: TestProfileCode = 'MARKETPLACE';
    const paymentId = this.required(paymentIdInput, 'Informe o Payment ID.');
    const config = await this.secretProfile(profile);
    const sellerToken = this.required(
      config.sellerAccessToken || config.accessToken,
      'Informe o Access Token OAuth do vendedor de teste do Marketplace.',
    );
    const payment = await this.request(sellerToken, 'GET', `/v1/payments/${encodeURIComponent(paymentId)}`);
    await this.record(profile, 'SPLIT_PAYMENT_FETCHED', true, paymentId, {
      status: payment?.status || null,
      statusDetail: payment?.status_detail || null,
    }, adminUserId);
    return {
      paymentId,
      status: payment?.status || null,
      statusDetail: payment?.status_detail || null,
      transactionAmount: payment?.transaction_amount || null,
      applicationFee: payment?.fee_details?.find?.((item: any) => item?.type === 'application_fee')?.amount || null,
      externalReference: payment?.external_reference || null,
    };
  }

  async history() {
    return this.dataSource.query(
      `SELECT id,"profileCode",action,success,"providerResourceId",metadata,"actorUserId","createdAt"
       FROM payment_provider_test_runs
       WHERE "providerCode"='MERCADO_PAGO'
       ORDER BY "createdAt" DESC
       LIMIT 100`,
    ).catch(() => []);
  }

  private async secretProfile(profile: TestProfileCode) {
    const rows = await this.dataSource.query(
      `SELECT "encryptedConfig" FROM payment_provider_test_profiles
       WHERE "providerCode"='MERCADO_PAGO' AND "profileCode"=$1 LIMIT 1`,
      [profile],
    );
    if (!rows[0]) return {} as TestProfileConfig;
    return this.vault.decrypt<TestProfileConfig>(rows[0].encryptedConfig);
  }

  private safeProfile(profile: TestProfileCode, config: TestProfileConfig, updatedAt: string | null) {
    return {
      profile,
      applicationId: config.applicationId || null,
      publicKeyConfigured: Boolean(config.publicKey),
      accessTokenConfigured: Boolean(config.accessToken),
      sellerAccessTokenConfigured: Boolean(config.sellerAccessToken),
      payerEmail: config.payerEmail || '',
      updatedAt,
    };
  }

  private profile(value: string): TestProfileCode {
    const profile = String(value || '').trim().toUpperCase();
    if (!['ORDERS','SUBSCRIPTIONS','MARKETPLACE'].includes(profile)) {
      throw new BadRequestException('Perfil de teste Mercado Pago inválido.');
    }
    return profile as TestProfileCode;
  }

  private tokenForProfile(profile: TestProfileCode, config: TestProfileConfig) {
    return this.required(
      profile === 'MARKETPLACE' ? config.sellerAccessToken || config.accessToken : config.accessToken,
      profile === 'MARKETPLACE'
        ? 'Informe o Access Token OAuth do vendedor de teste.'
        : 'Informe o Access Token de teste desta aplicação.',
    );
  }

  private text(value: unknown, max: number) {
    if (value === undefined) return undefined;
    return String(value || '').trim().slice(0, max);
  }

  private email(value: unknown, current?: string) {
    if (value === undefined) return current || '';
    const email = String(value || '').trim().slice(0, 320);
    if (email && !email.includes('@')) throw new BadRequestException('E-mail de teste inválido.');
    return email;
  }

  private required(value: unknown, message: string) {
    const text = String(value || '').trim();
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private async request(
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await response.text().catch(() => '');
    let parsed: any = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { message: text }; }
    if (!response.ok) {
      const detail = parsed?.message || parsed?.error || parsed?.cause?.[0]?.description || `HTTP ${response.status}`;
      throw new ServiceUnavailableException({
        code: 'MERCADO_PAGO_TEST_ERROR',
        status: response.status,
        message: `Mercado Pago teste: ${detail}`,
        providerResponse: parsed,
      });
    }
    return parsed;
  }

  private async record(
    profile: TestProfileCode,
    action: string,
    success: boolean,
    providerResourceId: string | null,
    metadata: Record<string, unknown>,
    actorUserId: string,
  ) {
    await this.dataSource.query(
      `INSERT INTO payment_provider_test_runs
        ("providerCode","profileCode",action,success,"providerResourceId",metadata,"actorUserId","createdAt")
       VALUES ('MERCADO_PAGO',$1,$2,$3,$4,$5::jsonb,$6,now())`,
      [profile, action, success, providerResourceId, JSON.stringify(metadata || {}), actorUserId],
    ).catch(() => undefined);
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message.slice(0, 500);
    return String(error || 'Erro desconhecido').slice(0, 500);
  }
}
