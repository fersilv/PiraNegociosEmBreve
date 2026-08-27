import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatGateway } from '../chat/chat.gateway';
import { PaymentsService } from './payments.service';
import {
  PaymentProviderConfigService,
  type MercadoPagoProviderConfig,
} from './payment-provider-config.service';

@Injectable()
export class PaymentCheckoutStatusService {
  private readonly watches = new Map<string, Promise<void>>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
    private readonly providerConfig: PaymentProviderConfigService,
    private readonly realtime: ChatGateway,
  ) {}

  async getForUser(userId: string, paymentId: string) {
    let payment = await this.find(userId, paymentId);
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');

    if (
      payment.status === 'PENDING'
      && payment.provider === 'MERCADO_PAGO'
      && payment.providerPaymentId
    ) {
      await this.reconcileMercadoPago(payment).catch(() => undefined);
      payment = await this.find(userId, paymentId) || payment;
    }

    const presented = this.present(payment);
    this.realtime.publishPaymentUpdate(userId, presented);
    return presented;
  }

  watchForUser(userId: string, paymentId: string) {
    const safeUserId = String(userId || '').trim();
    const safePaymentId = String(paymentId || '').trim();
    if (!safeUserId || !safePaymentId) return;
    const key = `${safeUserId}:${safePaymentId}`;
    if (this.watches.has(key)) return;

    const task = this.runWatch(safeUserId, safePaymentId)
      .catch(() => undefined)
      .finally(() => this.watches.delete(key));
    this.watches.set(key, task);
  }

  private async runWatch(userId: string, paymentId: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const state = await this.getForUser(userId, paymentId).catch(() => null);
      if (!state) return;
      if (state.completed === true) return;
      if (['CANCELED', 'EXPIRED', 'REFUNDED'].includes(String(state.status || '').toUpperCase())) return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  private async find(userId: string, paymentId: string) {
    const rows = await this.dataSource.query(
      `SELECT p.*, pp.name AS "productName", pp.description AS "productDescription",
              pp."billingType" AS "productBillingType", pp."durationDays"
       FROM payments p
       LEFT JOIN payment_products pp ON pp.code = p."productCode"
       WHERE p.id = $1 AND p."userId" = $2
       LIMIT 1`,
      [paymentId, userId],
    );
    return rows[0] || null;
  }

  private metadata(payment: any): Record<string, any> {
    if (payment?.metadata && typeof payment.metadata === 'object') return payment.metadata;
    try { return JSON.parse(String(payment?.metadata || '{}')); } catch { return {}; }
  }

  private isRecurring(payment: any, metadata = this.metadata(payment)) {
    return payment.purchaseMode === 'SUBSCRIPTION'
      || metadata.purchaseMode === 'SUBSCRIPTION'
      || metadata.paymentType === 'PIX_AUTOMATICO'
      || metadata.recurringApi === 'SUBSCRIPTIONS'
      || metadata.efiAutomaticPix === true
      || Boolean(metadata.mercadoPagoSubscriptionId);
  }

  private async reconcileMercadoPago(payment: any) {
    const config = await this.providerConfig.getSecretConfig<MercadoPagoProviderConfig>('MERCADO_PAGO');
    const token = String(config.accessToken || '').trim();
    if (!token) return;

    const metadata = this.metadata(payment);
    if (this.isRecurring(payment, metadata)) {
      await this.reconcileSubscription(payment, token);
      return;
    }

    await this.reconcileOrder(payment, token);
  }

  private async request(token: string, path: string) {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }

  private cents(value: unknown) {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? Math.round(number * 100) : -1;
  }

  private async reconcileOrder(payment: any, token: string) {
    const order = await this.request(token, `/v1/orders/${encodeURIComponent(String(payment.providerPaymentId))}`);
    if (!order) return;

    const receivedCents = this.cents(order?.total_amount);
    if (receivedCents >= 0 && receivedCents !== Number(payment.amountCents)) return;

    const transaction = Array.isArray(order?.transactions?.payments)
      ? order.transactions.payments[0] || {}
      : {};
    const paymentMethod = transaction?.payment_method || {};
    const providerStatus = String(transaction?.status || order?.status || '').toLowerCase();
    const providerStatusDetail = String(transaction?.status_detail || '').toLowerCase();
    const pixCopyPaste = String(paymentMethod?.qr_code || '').trim() || null;
    const qrCodeBase64 = String(paymentMethod?.qr_code_base64 || '').trim() || null;
    const ticketUrl = String(paymentMethod?.ticket_url || '').trim() || null;

    await this.dataSource.query(
      `UPDATE payments SET
         "pixCopyPaste" = COALESCE($2, "pixCopyPaste"),
         "qrCodeBase64" = COALESCE($3, "qrCodeBase64"),
         metadata = coalesce(metadata,'{}'::jsonb) || $4::jsonb,
         "updatedAt" = now()
       WHERE id = $1`,
      [
        payment.id,
        pixCopyPaste,
        qrCodeBase64,
        JSON.stringify({
          mercadoPagoOrderId: order?.id || payment.providerPaymentId,
          mercadoPagoOrderStatus: order?.status || null,
          mercadoPagoTransactionId: transaction?.id || null,
          mercadoPagoTransactionStatus: providerStatus || null,
          mercadoPagoStatusDetail: providerStatusDetail || null,
          ticketUrl,
          checkoutApi: 'ORDERS',
        }),
      ],
    );

    if (providerStatus === 'processed' && providerStatusDetail === 'accredited') {
      await this.payments.confirmProviderPayment(payment.id, {
        provider: 'MERCADO_PAGO',
        mercadoPagoOrderId: order?.id || payment.providerPaymentId,
        mercadoPagoTransactionId: transaction?.id || null,
        mercadoPagoTransactionStatus: providerStatus,
        mercadoPagoStatusDetail: providerStatusDetail,
        confirmationMode: 'MERCADO_PAGO_ORDER_REALTIME_WATCH',
      }).catch(() => undefined);
    }
  }

  private async reconcileSubscription(payment: any, token: string) {
    const metadata = this.metadata(payment);
    const subscriptionId = String(metadata.mercadoPagoSubscriptionId || payment.providerPaymentId || '').trim();
    if (!subscriptionId) return;
    const subscription = await this.request(token, `/preapproval/${encodeURIComponent(subscriptionId)}`);
    if (!subscription) return;

    const status = String(subscription?.status || '').toLowerCase();
    await this.dataSource.query(
      `UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now()
       WHERE id = $1`,
      [payment.id, JSON.stringify({
        purchaseMode: 'SUBSCRIPTION',
        paymentType: 'PIX_AUTOMATICO',
        mercadoPagoSubscriptionId: subscriptionId,
        mercadoPagoSubscriptionStatus: status || null,
        mercadoPagoNextPaymentDate: subscription?.next_payment_date || null,
        subscriptionCheckoutUrl: subscription?.init_point || metadata.subscriptionCheckoutUrl || null,
        recurringApi: 'SUBSCRIPTIONS',
      })],
    );

    if (status === 'authorized') {
      await this.payments.activateCompanyPlanTrial(payment.id, {
        provider: 'MERCADO_PAGO',
        providerSubscriptionId: subscriptionId,
      }).catch(() => undefined);
    }
  }

  private present(payment: any) {
    const metadata = this.metadata(payment);
    const recurring = this.isRecurring(payment, metadata);
    const purchaseMode = recurring ? 'SUBSCRIPTION' : 'ONE_TIME';
    const subscriptionStatus = String(metadata.mercadoPagoSubscriptionStatus || metadata.efiRecurrenceStatus || '').toLowerCase();
    const authorizationUrl = recurring ? metadata.subscriptionCheckoutUrl || null : null;
    const ticketUrl = !recurring ? metadata.ticketUrl || null : null;
    const completed = payment.status === 'PAID'
      || metadata.companyEliteTrialActivated === true;

    return {
      id: payment.id,
      paymentId: payment.id,
      productCode: payment.productCode,
      productName: payment.productName || payment.productCode,
      productDescription: payment.productDescription || null,
      purchaseMode,
      billingType: recurring ? 'RECURRING' : 'ONE_TIME',
      amountCents: Number(payment.amountCents || 0),
      originalAmountCents: Number(payment.originalAmountCents || payment.amountCents || 0),
      discountCents: Number(payment.discountCents || 0),
      status: payment.status,
      provider: payment.provider || null,
      providerPaymentId: payment.providerPaymentId || null,
      pixCopyPaste: payment.pixCopyPaste || null,
      qrCodeBase64: payment.qrCodeBase64 || null,
      expiresAt: payment.expiresAt || null,
      paidAt: payment.paidAt || null,
      checkoutReady: Boolean(payment.pixCopyPaste || payment.qrCodeBase64 || authorizationUrl || ticketUrl),
      authorizationUrl,
      ticketUrl,
      recurring,
      subscriptionStatus: subscriptionStatus || null,
      authorizationComplete: recurring && ['authorized', 'ativa', 'active'].includes(subscriptionStatus),
      providerStatus: metadata.mercadoPagoTransactionStatus || metadata.mercadoPagoOrderStatus || metadata.efiRecurrenceStatus || null,
      providerStatusDetail: metadata.mercadoPagoStatusDetail || null,
      completed,
      awaitingPayment: !completed && payment.status === 'PENDING',
      metadata: {
        purchaseMode,
        paymentType: recurring ? 'PIX_AUTOMATICO' : 'PIX',
        checkoutApi: metadata.checkoutApi || null,
        recurringApi: metadata.recurringApi || null,
        efiAutomaticPix: metadata.efiAutomaticPix === true,
      },
    };
  }
}
