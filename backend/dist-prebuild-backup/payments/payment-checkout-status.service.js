"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentCheckoutStatusService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const chat_gateway_1 = require("../chat/chat.gateway");
const payments_service_1 = require("./payments.service");
const payment_provider_config_service_1 = require("./payment-provider-config.service");
let PaymentCheckoutStatusService = class PaymentCheckoutStatusService {
    dataSource;
    payments;
    providerConfig;
    realtime;
    watches = new Map();
    constructor(dataSource, payments, providerConfig, realtime) {
        this.dataSource = dataSource;
        this.payments = payments;
        this.providerConfig = providerConfig;
        this.realtime = realtime;
    }
    async getForUser(userId, paymentId) {
        let payment = await this.find(userId, paymentId);
        if (!payment)
            throw new common_1.NotFoundException('Pagamento não encontrado.');
        if (payment.status === 'PENDING'
            && payment.provider === 'MERCADO_PAGO'
            && payment.providerPaymentId) {
            await this.reconcileMercadoPago(payment).catch(() => undefined);
            payment = await this.find(userId, paymentId) || payment;
        }
        const presented = this.present(payment);
        this.realtime.publishPaymentUpdate(userId, presented);
        return presented;
    }
    watchForUser(userId, paymentId) {
        const safeUserId = String(userId || '').trim();
        const safePaymentId = String(paymentId || '').trim();
        if (!safeUserId || !safePaymentId)
            return;
        const key = `${safeUserId}:${safePaymentId}`;
        if (this.watches.has(key))
            return;
        const task = this.runWatch(safeUserId, safePaymentId)
            .catch(() => undefined)
            .finally(() => this.watches.delete(key));
        this.watches.set(key, task);
    }
    async runWatch(userId, paymentId) {
        for (let attempt = 0; attempt < 60; attempt += 1) {
            const state = await this.getForUser(userId, paymentId).catch(() => null);
            if (!state)
                return;
            if (state.completed === true)
                return;
            if (['CANCELED', 'EXPIRED', 'REFUNDED'].includes(String(state.status || '').toUpperCase()))
                return;
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }
    async find(userId, paymentId) {
        const rows = await this.dataSource.query(`SELECT p.*, pp.name AS "productName", pp.description AS "productDescription",
              pp."billingType" AS "productBillingType", pp."durationDays"
       FROM payments p
       LEFT JOIN payment_products pp ON pp.code = p."productCode"
       WHERE p.id = $1 AND p."userId" = $2
       LIMIT 1`, [paymentId, userId]);
        return rows[0] || null;
    }
    metadata(payment) {
        if (payment?.metadata && typeof payment.metadata === 'object')
            return payment.metadata;
        try {
            return JSON.parse(String(payment?.metadata || '{}'));
        }
        catch {
            return {};
        }
    }
    isRecurring(payment, metadata = this.metadata(payment)) {
        return payment.purchaseMode === 'SUBSCRIPTION'
            || metadata.purchaseMode === 'SUBSCRIPTION'
            || metadata.paymentType === 'PIX_AUTOMATICO'
            || metadata.recurringApi === 'SUBSCRIPTIONS'
            || metadata.efiAutomaticPix === true
            || Boolean(metadata.mercadoPagoSubscriptionId);
    }
    async reconcileMercadoPago(payment) {
        const config = await this.providerConfig.getSecretConfig('MERCADO_PAGO');
        const token = String(config.accessToken || '').trim();
        if (!token)
            return;
        const metadata = this.metadata(payment);
        if (this.isRecurring(payment, metadata)) {
            await this.reconcileSubscription(payment, token);
            return;
        }
        await this.reconcileOrder(payment, token);
    }
    async request(token, path) {
        const response = await fetch(`https://api.mercadopago.com${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok)
            return null;
        return response.json().catch(() => null);
    }
    cents(value) {
        const number = Number(String(value ?? '').replace(',', '.'));
        return Number.isFinite(number) ? Math.round(number * 100) : -1;
    }
    async reconcileOrder(payment, token) {
        const order = await this.request(token, `/v1/orders/${encodeURIComponent(String(payment.providerPaymentId))}`);
        if (!order)
            return;
        const receivedCents = this.cents(order?.total_amount);
        if (receivedCents >= 0 && receivedCents !== Number(payment.amountCents))
            return;
        const transaction = Array.isArray(order?.transactions?.payments)
            ? order.transactions.payments[0] || {}
            : {};
        const paymentMethod = transaction?.payment_method || {};
        const providerStatus = String(transaction?.status || order?.status || '').toLowerCase();
        const providerStatusDetail = String(transaction?.status_detail || '').toLowerCase();
        const pixCopyPaste = String(paymentMethod?.qr_code || '').trim() || null;
        const qrCodeBase64 = String(paymentMethod?.qr_code_base64 || '').trim() || null;
        const ticketUrl = String(paymentMethod?.ticket_url || '').trim() || null;
        await this.dataSource.query(`UPDATE payments SET
         "pixCopyPaste" = COALESCE($2, "pixCopyPaste"),
         "qrCodeBase64" = COALESCE($3, "qrCodeBase64"),
         metadata = coalesce(metadata,'{}'::jsonb) || $4::jsonb,
         "updatedAt" = now()
       WHERE id = $1`, [
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
        ]);
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
    async reconcileSubscription(payment, token) {
        const metadata = this.metadata(payment);
        const subscriptionId = String(metadata.mercadoPagoSubscriptionId || payment.providerPaymentId || '').trim();
        if (!subscriptionId)
            return;
        const subscription = await this.request(token, `/preapproval/${encodeURIComponent(subscriptionId)}`);
        if (!subscription)
            return;
        const status = String(subscription?.status || '').toLowerCase();
        await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now()
       WHERE id = $1`, [payment.id, JSON.stringify({
                purchaseMode: 'SUBSCRIPTION',
                paymentType: 'PIX_AUTOMATICO',
                mercadoPagoSubscriptionId: subscriptionId,
                mercadoPagoSubscriptionStatus: status || null,
                mercadoPagoNextPaymentDate: subscription?.next_payment_date || null,
                subscriptionCheckoutUrl: subscription?.init_point || metadata.subscriptionCheckoutUrl || null,
                recurringApi: 'SUBSCRIPTIONS',
            })]);
        if (status === 'authorized') {
            await this.payments.activateCompanyPlanTrial(payment.id, {
                provider: 'MERCADO_PAGO',
                providerSubscriptionId: subscriptionId,
            }).catch(() => undefined);
        }
    }
    present(payment) {
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
};
exports.PaymentCheckoutStatusService = PaymentCheckoutStatusService;
exports.PaymentCheckoutStatusService = PaymentCheckoutStatusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        payments_service_1.PaymentsService,
        payment_provider_config_service_1.PaymentProviderConfigService,
        chat_gateway_1.ChatGateway])
], PaymentCheckoutStatusService);
//# sourceMappingURL=payment-checkout-status.service.js.map