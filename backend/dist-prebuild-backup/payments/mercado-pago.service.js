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
exports.MercadoPagoService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const payments_service_1 = require("./payments.service");
const payment_provider_config_service_1 = require("./payment-provider-config.service");
let MercadoPagoService = class MercadoPagoService {
    dataSource;
    payments;
    providerConfig;
    constructor(dataSource, payments, providerConfig) {
        this.dataSource = dataSource;
        this.payments = payments;
        this.providerConfig = providerConfig;
    }
    async config() {
        return this.providerConfig.getSecretConfig('MERCADO_PAGO');
    }
    async sdk() {
        try {
            const importer = new Function('moduleName', 'return import(moduleName)');
            return await importer('mercadopago');
        }
        catch {
            throw new common_1.ServiceUnavailableException('SDK Mercado Pago não instalado. Execute npm install no backend após atualizar o projeto.');
        }
    }
    assertConfigured(config) {
        const missing = [];
        if (!config.accessToken)
            missing.push('Access Token');
        if (!config.publicApiBaseUrl)
            missing.push('URL pública da API');
        if (!config.webhookSecret)
            missing.push('Assinatura secreta do Webhook');
        if (missing.length) {
            throw new common_1.ServiceUnavailableException(`Mercado Pago não configurado: faltando ${missing.join(', ')}.`);
        }
    }
    webhookUrl(config) {
        const base = String(config.publicApiBaseUrl || '').trim().replace(/\/$/, '');
        if (!base)
            throw new common_1.ServiceUnavailableException('Informe a URL pública da API para receber Webhooks do Mercado Pago.');
        return `${base}/payments/webhooks/mercado-pago`;
    }
    returnUrl(config) {
        const apiBase = String(config.publicApiBaseUrl || '').trim().replace(/\/$/, '');
        if (!apiBase)
            throw new common_1.ServiceUnavailableException('Informe a URL pública da API para concluir a assinatura.');
        const siteBase = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
        return `${siteBase}/user/pagamentos`;
    }
    async request(config, method, path, body, idempotencyKey) {
        this.assertConfigured(config);
        const headers = {
            Accept: 'application/json',
            Authorization: `Bearer ${String(config.accessToken)}`,
        };
        if (body !== undefined)
            headers['Content-Type'] = 'application/json';
        if (idempotencyKey)
            headers['X-Idempotency-Key'] = idempotencyKey;
        const response = await fetch(`https://api.mercadopago.com${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(20000),
        });
        const text = await response.text().catch(() => '');
        let parsed = {};
        try {
            parsed = text ? JSON.parse(text) : {};
        }
        catch {
            parsed = { message: text };
        }
        if (!response.ok) {
            const detail = parsed?.message || parsed?.error || parsed?.cause?.[0]?.description || `HTTP ${response.status}`;
            throw new common_1.ServiceUnavailableException({
                code: 'MERCADO_PAGO_ERROR',
                provider: 'MERCADO_PAGO',
                status: response.status,
                message: `Mercado Pago: ${detail}`,
                providerResponse: parsed,
            });
        }
        return parsed;
    }
    async healthCheck() {
        const config = await this.config();
        this.assertConfigured(config);
        const sdk = await this.sdk();
        if (!sdk?.WebhookSignatureValidator) {
            throw new common_1.ServiceUnavailableException('SDK Mercado Pago instalado, mas sem validador de assinatura Webhook compatível.');
        }
        const me = await this.request(config, 'GET', '/users/me');
        return {
            operational: true,
            message: 'Mercado Pago respondeu com credenciais válidas; Orders, Assinaturas e validação de Webhook estão disponíveis.',
            details: {
                userId: me?.id || null,
                nickname: me?.nickname || null,
                webhookUrl: this.webhookUrl(config),
                sdk: 'mercadopago',
                checkoutApi: 'ORDERS',
                recurringApi: 'SUBSCRIPTIONS',
                capabilities: ['PIX', 'PIX_AUTOMATICO'],
            },
        };
    }
    amount(cents) {
        return (Math.max(0, Math.round(cents)) / 100).toFixed(2);
    }
    decimalToCents(value) {
        const parsed = Number(String(value ?? '').replace(',', '.'));
        return Number.isFinite(parsed) ? Math.round(parsed * 100) : -1;
    }
    normalizePayerDocument(payer) {
        const document = String(payer.document || '').replace(/\D/g, '');
        if (!document)
            return null;
        const requestedType = String(payer.documentType || '').toUpperCase();
        const type = requestedType === 'CNPJ' || (!requestedType && document.length === 14)
            ? 'CNPJ'
            : 'CPF';
        const expectedLength = type === 'CNPJ' ? 14 : 11;
        if (document.length !== expectedLength) {
            throw new common_1.BadRequestException(`Informe um ${type} válido para o pagador.`);
        }
        return { type, number: document };
    }
    async createImmediateCharge(amountCents, paymentId, productName, payer) {
        const config = await this.config();
        const email = String(payer.email || '').trim();
        if (!email || !email.includes('@')) {
            throw new common_1.BadRequestException('O Mercado Pago exige o e-mail do pagador para gerar o Pix.');
        }
        const identification = this.normalizePayerDocument(payer);
        const amount = this.amount(amountCents);
        const order = await this.request(config, 'POST', '/v1/orders', {
            type: 'online',
            total_amount: amount,
            external_reference: paymentId,
            processing_mode: 'automatic',
            transactions: {
                payments: [{
                        amount,
                        payment_method: { id: 'pix', type: 'bank_transfer' },
                        expiration_time: 'PT1H',
                    }],
            },
            payer: {
                email,
                ...(identification ? { identification } : {}),
            },
        }, paymentId);
        const providerPaymentId = String(order?.id || '').trim();
        if (!providerPaymentId)
            throw new common_1.ServiceUnavailableException('O Mercado Pago não retornou o ID da order.');
        const transaction = Array.isArray(order?.transactions?.payments) ? order.transactions.payments[0] || {} : {};
        const paymentMethod = transaction?.payment_method || {};
        return {
            provider: 'MERCADO_PAGO',
            providerPaymentId,
            pixCopyPaste: paymentMethod.qr_code || null,
            qrCodeBase64: paymentMethod.qr_code_base64 || null,
            expiresAt: null,
            metadata: {
                mercadoPagoOrderId: providerPaymentId,
                mercadoPagoOrderStatus: order?.status || null,
                mercadoPagoTransactionId: transaction?.id || null,
                mercadoPagoTransactionStatus: transaction?.status || null,
                mercadoPagoStatusDetail: transaction?.status_detail || null,
                ticketUrl: paymentMethod.ticket_url || null,
                externalReference: paymentId,
                checkoutApi: 'ORDERS',
                payerDocumentType: identification?.type || null,
            },
        };
    }
    async createRecurringCheckout(amountCents, paymentId, productName, payer, trialDays = 0) {
        const config = await this.config();
        const email = String(payer.email || '').trim();
        if (!email || !email.includes('@')) {
            throw new common_1.BadRequestException('O Mercado Pago exige o e-mail da conta para iniciar a assinatura.');
        }
        const safeTrialDays = Math.max(0, Math.min(30, Math.round(Number(trialDays || 0))));
        const trialStartDate = safeTrialDays > 0
            ? new Date(Date.now() + safeTrialDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined;
        const subscription = await this.request(config, 'POST', '/preapproval', {
            reason: String(productName || 'Plano mensal PiraNegócios').slice(0, 180),
            external_reference: paymentId,
            payer_email: email,
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                start_date: trialStartDate,
                transaction_amount: Math.max(0, Math.round(amountCents)) / 100,
                currency_id: 'BRL',
            },
            back_url: this.returnUrl(config),
            status: 'pending',
        }, `subscription-${paymentId}`);
        const providerPaymentId = String(subscription?.id || '').trim();
        const initPoint = String(subscription?.init_point || '').trim();
        if (!providerPaymentId || !initPoint) {
            throw new common_1.ServiceUnavailableException('O Mercado Pago não retornou a jornada de autorização da assinatura.');
        }
        return {
            provider: 'MERCADO_PAGO',
            providerPaymentId,
            pixCopyPaste: null,
            qrCodeBase64: null,
            expiresAt: null,
            metadata: {
                mercadoPagoSubscriptionId: providerPaymentId,
                mercadoPagoSubscriptionStatus: subscription?.status || 'pending',
                subscriptionCheckoutUrl: initPoint,
                ticketUrl: initPoint,
                externalReference: paymentId,
                recurringApi: 'SUBSCRIPTIONS',
                paymentType: 'PIX_AUTOMATICO',
                requiresAuthorization: true,
                mercadoPagoTrialDays: safeTrialDays,
                mercadoPagoTrialStartDate: trialStartDate || null,
            },
        };
    }
    async validateSignature(config, xSignature, xRequestId, dataId) {
        const secret = String(config.webhookSecret || '');
        if (!secret)
            throw new common_1.UnauthorizedException('Assinatura secreta do Webhook Mercado Pago não configurada.');
        if (!xSignature || !xRequestId || !dataId)
            throw new common_1.UnauthorizedException('Webhook Mercado Pago sem assinatura completa.');
        const sdk = await this.sdk();
        try {
            sdk.WebhookSignatureValidator.validate({
                xSignature,
                xRequestId,
                dataId,
                secret,
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Assinatura do Webhook Mercado Pago inválida.');
        }
    }
    async findPaymentByExternalReference(externalReference) {
        const id = String(externalReference || '').trim();
        if (!id)
            return null;
        const rows = await this.dataSource.query(`SELECT * FROM payments WHERE id = $1 AND provider = 'MERCADO_PAGO' LIMIT 1`, [id]);
        return rows[0] || null;
    }
    async handleOrder(dataId, config) {
        const order = await this.request(config, 'GET', `/v1/orders/${encodeURIComponent(dataId)}`);
        const local = await this.findPaymentByExternalReference(order?.external_reference)
            || (await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'MERCADO_PAGO' AND "providerPaymentId" = $1 LIMIT 1`, [dataId]))[0];
        if (!local)
            return { ok: true, ignored: true, reason: 'payment_not_found', dataId };
        const expectedCents = Number(local.amountCents);
        const receivedCents = this.decimalToCents(order?.total_amount);
        if (receivedCents !== expectedCents) {
            return { ok: true, ignored: true, reason: 'amount_mismatch', dataId };
        }
        const transaction = Array.isArray(order?.transactions?.payments) ? order.transactions.payments[0] || {} : {};
        const status = String(transaction?.status || order?.status || '').toLowerCase();
        const statusDetail = String(transaction?.status_detail || '').toLowerCase();
        if (status === 'processed' && statusDetail === 'accredited') {
            const settled = await this.payments.confirmProviderPayment(local.id, {
                provider: 'MERCADO_PAGO',
                mercadoPagoOrderId: dataId,
                mercadoPagoTransactionId: transaction?.id || null,
                mercadoPagoTransactionStatus: status,
                mercadoPagoStatusDetail: statusDetail,
                confirmationMode: 'MERCADO_PAGO_ORDER_WEBHOOK',
            });
            return { ok: true, paymentId: local.id, status: settled.status };
        }
        await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`, [local.id, JSON.stringify({
                mercadoPagoOrderStatus: order?.status || null,
                mercadoPagoTransactionStatus: status || null,
                mercadoPagoStatusDetail: statusDetail || null,
            })]);
        return { ok: true, paymentId: local.id, status: status || order?.status || null };
    }
    async handleSubscription(dataId, config) {
        const subscription = await this.request(config, 'GET', `/preapproval/${encodeURIComponent(dataId)}`);
        const externalReference = String(subscription?.external_reference || '').trim();
        const local = await this.findPaymentByExternalReference(externalReference)
            || (await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'MERCADO_PAGO' AND metadata->>'mercadoPagoSubscriptionId' = $1 ORDER BY "createdAt" ASC LIMIT 1`, [dataId]))[0];
        if (!local)
            return { ok: true, ignored: true, reason: 'subscription_payment_not_found', dataId };
        const status = String(subscription?.status || '').toLowerCase();
        await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`, [local.id, JSON.stringify({
                mercadoPagoSubscriptionId: dataId,
                mercadoPagoSubscriptionStatus: status,
                mercadoPagoNextPaymentDate: subscription?.next_payment_date || null,
            })]);
        if (status === 'authorized') {
            await this.payments.activateCompanyPlanTrial(local.id, { provider: 'MERCADO_PAGO', providerSubscriptionId: dataId }).catch(() => undefined);
            await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`, [local.id, JSON.stringify({ companyEliteTrialSubscriptionAuthorized: true })]).catch(() => undefined);
        }
        const localSubscriptionStatus = status === 'cancelled' || status === 'canceled'
            ? 'CANCELED'
            : status === 'paused'
                ? 'PAST_DUE'
                : null;
        if (localSubscriptionStatus) {
            await this.dataSource.query(`UPDATE subscriptions SET status = $2, "updatedAt" = now(),
           metadata = coalesce(metadata,'{}'::jsonb) || $3::jsonb
         WHERE "providerSubscriptionId" = $1 OR id = (SELECT "subscriptionId" FROM payments WHERE id = $4)
         RETURNING id`, [dataId, localSubscriptionStatus, JSON.stringify({ mercadoPagoSubscriptionStatus: status }), local.id]).catch(() => undefined);
        }
        return { ok: true, paymentId: local.id, subscriptionId: dataId, status };
    }
    async ensureAuthorizedPaymentRow(invoice) {
        const externalReference = String(invoice?.external_reference || '').trim();
        const preapprovalId = String(invoice?.preapproval_id || '').trim();
        const invoiceId = String(invoice?.id || '').trim();
        const providerPaymentId = String(invoice?.payment?.id || invoiceId).trim();
        let base = await this.findPaymentByExternalReference(externalReference);
        if (!base && preapprovalId) {
            const rows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'MERCADO_PAGO' AND metadata->>'mercadoPagoSubscriptionId' = $1 ORDER BY "createdAt" ASC LIMIT 1`, [preapprovalId]);
            base = rows[0] || null;
        }
        if (!base)
            return null;
        const amountCents = this.decimalToCents(invoice?.transaction_amount);
        if (amountCents !== Number(base.amountCents))
            return { mismatch: true, payment: base };
        if (base.status === 'PENDING')
            return { payment: base, renewal: false };
        const existing = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'MERCADO_PAGO'
       AND ("providerPaymentId" = $1 OR metadata->>'mercadoPagoAuthorizedPaymentId' = $2)
       LIMIT 1`, [providerPaymentId, invoiceId]);
        if (existing[0])
            return { payment: existing[0], renewal: true };
        const inserted = await this.dataSource.query(`INSERT INTO payments
        ("userId","productCode",method,status,"originalAmountCents","amountCents","discountCents",provider,"providerPaymentId",metadata)
       VALUES ($1,$2,'PIX','PENDING',$3,$4,$5,'MERCADO_PAGO',$6,$7::jsonb)
       RETURNING *`, [
            base.userId,
            base.productCode,
            Number(base.originalAmountCents),
            Number(base.amountCents),
            Number(base.discountCents || 0),
            providerPaymentId,
            JSON.stringify({
                mercadoPagoAutomaticRenewal: true,
                mercadoPagoSubscriptionId: preapprovalId || null,
                mercadoPagoAuthorizedPaymentId: invoiceId || null,
                parentPaymentId: base.id,
                recurringApi: 'SUBSCRIPTIONS',
                paymentType: 'PIX_AUTOMATICO',
            }),
        ]);
        return { payment: inserted[0], renewal: true };
    }
    async handleAuthorizedPayment(dataId, config) {
        const invoice = await this.request(config, 'GET', `/authorized_payments/${encodeURIComponent(dataId)}`);
        const prepared = await this.ensureAuthorizedPaymentRow(invoice);
        if (!prepared)
            return { ok: true, ignored: true, reason: 'subscription_payment_not_found', dataId };
        if (prepared.mismatch)
            return { ok: true, ignored: true, reason: 'amount_mismatch', dataId };
        const paymentStatus = String(invoice?.payment?.status || '').toLowerCase();
        const statusDetail = String(invoice?.payment?.status_detail || '').toLowerCase();
        const payment = prepared.payment;
        if (paymentStatus !== 'approved') {
            await this.dataSource.query(`UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`, [payment.id, JSON.stringify({
                    mercadoPagoAuthorizedPaymentId: String(invoice?.id || dataId),
                    mercadoPagoSubscriptionId: invoice?.preapproval_id || null,
                    mercadoPagoInvoiceStatus: invoice?.status || null,
                    mercadoPagoPaymentStatus: paymentStatus || null,
                    mercadoPagoStatusDetail: statusDetail || null,
                })]);
            return { ok: true, paymentId: payment.id, status: paymentStatus || invoice?.status || null };
        }
        const settled = await this.payments.confirmProviderPayment(payment.id, {
            provider: 'MERCADO_PAGO',
            mercadoPagoAuthorizedPaymentId: String(invoice?.id || dataId),
            mercadoPagoSubscriptionId: invoice?.preapproval_id || null,
            mercadoPagoPaymentId: invoice?.payment?.id || null,
            mercadoPagoPaymentStatus: paymentStatus,
            mercadoPagoStatusDetail: statusDetail,
            mercadoPagoDebitDate: invoice?.debit_date || null,
            automaticRenewal: prepared.renewal === true,
            confirmationMode: 'MERCADO_PAGO_SUBSCRIPTION_WEBHOOK',
        });
        await this.dataSource.query(`UPDATE subscriptions SET provider = 'MERCADO_PAGO', "providerSubscriptionId" = $1, "updatedAt" = now(),
         metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb
       WHERE id = (SELECT "subscriptionId" FROM payments WHERE id = $3)
          OR ("userId" = $4 AND "productCode" = $5 AND status = 'ACTIVE')`, [
            invoice?.preapproval_id || null,
            JSON.stringify({ mercadoPagoSubscriptionStatus: 'authorized' }),
            payment.id,
            payment.userId,
            payment.productCode,
        ]).catch(() => undefined);
        return { ok: true, paymentId: payment.id, status: settled.status, renewal: prepared.renewal === true };
    }
    async handleLegacyPayment(dataId, config) {
        const detail = await this.request(config, 'GET', `/v1/payments/${encodeURIComponent(dataId)}`);
        const localId = String(detail?.external_reference || '').trim();
        let rows = [];
        if (localId) {
            rows = await this.dataSource.query(`SELECT * FROM payments WHERE id = $1 AND provider = 'MERCADO_PAGO' LIMIT 1`, [localId]);
        }
        if (!rows[0]) {
            rows = await this.dataSource.query(`SELECT * FROM payments WHERE provider = 'MERCADO_PAGO' AND "providerPaymentId" = $1 LIMIT 1`, [dataId]);
        }
        const payment = rows[0];
        if (!payment)
            return { ok: true, ignored: true, reason: 'payment_not_found', dataId };
        const paidCents = Math.round(Number(detail?.transaction_amount || 0) * 100);
        if (paidCents !== Number(payment.amountCents))
            return { ok: true, ignored: true, reason: 'amount_mismatch', dataId };
        const status = String(detail?.status || '').toLowerCase();
        if (status !== 'approved')
            return { ok: true, paymentId: payment.id, status };
        const settled = await this.payments.confirmProviderPayment(payment.id, {
            provider: 'MERCADO_PAGO',
            mercadoPagoPaymentId: dataId,
            mercadoPagoStatus: status,
            confirmationMode: 'MERCADO_PAGO_LEGACY_PAYMENT_WEBHOOK',
        });
        return { ok: true, paymentId: payment.id, status: settled.status };
    }
    async handleWebhook(body, query, headers) {
        const config = await this.config();
        const dataId = String(query?.['data.id'] || query?.data_id || body?.data?.id || '').trim();
        await this.validateSignature(config, String(headers['x-signature'] || ''), String(headers['x-request-id'] || ''), dataId);
        const type = String(query?.type || body?.type || '').toLowerCase();
        if (!dataId)
            return { ok: true, ignored: true, reason: 'missing_data_id', type };
        if (type === 'order' || type === 'orders')
            return this.handleOrder(dataId, config);
        if (type === 'subscription_preapproval')
            return this.handleSubscription(dataId, config);
        if (type === 'subscription_authorized_payment')
            return this.handleAuthorizedPayment(dataId, config);
        if (type === 'payment' || type === 'payments')
            return this.handleLegacyPayment(dataId, config);
        return { ok: true, ignored: true, type, dataId };
    }
};
exports.MercadoPagoService = MercadoPagoService;
exports.MercadoPagoService = MercadoPagoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        payments_service_1.PaymentsService,
        payment_provider_config_service_1.PaymentProviderConfigService])
], MercadoPagoService);
//# sourceMappingURL=mercado-pago.service.js.map