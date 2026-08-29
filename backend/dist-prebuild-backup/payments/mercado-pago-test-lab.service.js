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
exports.MercadoPagoTestLabService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const typeorm_1 = require("typeorm");
const payment_provider_vault_service_1 = require("./payment-provider-vault.service");
let MercadoPagoTestLabService = class MercadoPagoTestLabService {
    dataSource;
    vault;
    constructor(dataSource, vault) {
        this.dataSource = dataSource;
        this.vault = vault;
    }
    async overview() {
        const rows = await this.dataSource.query(`SELECT "profileCode","encryptedConfig","updatedAt"
       FROM payment_provider_test_profiles
       WHERE "providerCode"='MERCADO_PAGO'`);
        const profiles = {};
        for (const row of rows) {
            const config = this.vault.decrypt(row.encryptedConfig);
            profiles[row.profileCode] = this.safeProfile(row.profileCode, config, row.updatedAt);
        }
        for (const profile of ['ORDERS', 'SUBSCRIPTIONS', 'MARKETPLACE']) {
            if (!profiles[profile])
                profiles[profile] = this.safeProfile(profile, {}, null);
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
    async saveProfile(profileInput, input, adminUserId) {
        const profile = this.profile(profileInput);
        const current = await this.secretProfile(profile).catch(() => ({}));
        const next = {
            applicationId: this.text(input.applicationId, 80) ?? current.applicationId ?? '',
            publicKey: this.text(input.publicKey, 1200) ?? current.publicKey ?? '',
            accessToken: this.text(input.accessToken, 2600) ?? current.accessToken ?? '',
            sellerAccessToken: profile === 'MARKETPLACE'
                ? this.text(input.sellerAccessToken, 2600) ?? current.sellerAccessToken ?? ''
                : '',
            payerEmail: this.email(input.payerEmail, current.payerEmail),
        };
        if (input.removeAccessToken === true)
            next.accessToken = '';
        if (input.removePublicKey === true)
            next.publicKey = '';
        if (input.removeSellerAccessToken === true)
            next.sellerAccessToken = '';
        await this.dataSource.query(`INSERT INTO payment_provider_test_profiles
        ("providerCode","profileCode","encryptedConfig","updatedBy","createdAt","updatedAt")
       VALUES ('MERCADO_PAGO',$1,$2,$3,now(),now())
       ON CONFLICT ("providerCode","profileCode") DO UPDATE SET
         "encryptedConfig"=EXCLUDED."encryptedConfig", "updatedBy"=EXCLUDED."updatedBy", "updatedAt"=now()`, [profile, this.vault.encrypt(next), adminUserId]);
        return this.safeProfile(profile, next, new Date().toISOString());
    }
    async testCredentials(profileInput, adminUserId) {
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
        }
        catch (error) {
            await this.record(profile, 'CREDENTIALS_CHECK', false, null, { error: this.errorMessage(error) }, adminUserId);
            throw error;
        }
    }
    async createOrder(adminUserId) {
        const profile = 'ORDERS';
        const config = await this.secretProfile(profile);
        const token = this.required(config.accessToken, 'Cadastre o Access Token de teste da aplicação Orders.');
        const payerEmail = 'test_user_br@testuser.com';
        const externalReference = `pn-test-order-${Date.now()}`;
        const idempotency = (0, crypto_1.randomUUID)();
        try {
            const order = await this.request(token, 'POST', '/v1/orders', {
                type: 'online',
                external_reference: externalReference,
                total_amount: '50.00',
                payer: {
                    email: payerEmail,
                    first_name: 'APRO',
                },
                transactions: {
                    payments: [{
                            amount: '50.00',
                            payment_method: { id: 'pix', type: 'bank_transfer' },
                        }],
                },
            }, idempotency);
            const id = String(order?.id || '').trim();
            if (!id)
                throw new common_1.ServiceUnavailableException('O Mercado Pago criou a resposta sem retornar o Order ID.');
            const transaction = Array.isArray(order?.transactions?.payments) ? order.transactions.payments[0] || {} : {};
            await this.record(profile, 'ORDER_PIX_CREATED', true, id, {
                status: order?.status || null,
                statusDetail: order?.status_detail || null,
                transactionId: transaction?.id || null,
                transactionStatus: transaction?.status || null,
                transactionStatusDetail: transaction?.status_detail || null,
                externalReference,
                amount: '50.00',
                certificationScenario: 'PIX_APRO',
            }, adminUserId);
            return {
                ok: true,
                profile,
                orderId: id,
                transactionId: transaction?.id || null,
                status: order?.status || null,
                statusDetail: order?.status_detail || null,
                transactionStatus: transaction?.status || null,
                transactionStatusDetail: transaction?.status_detail || null,
                externalReference,
                amount: '50.00',
                payerEmail,
                certificationScenario: 'PIX_APRO',
            };
        }
        catch (error) {
            await this.record(profile, 'ORDER_PIX_CREATED', false, null, { error: this.errorMessage(error) }, adminUserId);
            throw error;
        }
    }
    async getOrder(orderIdInput, adminUserId) {
        const profile = 'ORDERS';
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
    async createSubscription(adminUserId) {
        const profile = 'SUBSCRIPTIONS';
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
            }, `pn-sub-${(0, crypto_1.randomUUID)()}`);
            const id = String(subscription?.id || '').trim();
            if (!id)
                throw new common_1.ServiceUnavailableException('O Mercado Pago não retornou o Preapproval ID.');
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
        }
        catch (error) {
            await this.record(profile, 'PREAPPROVAL_CREATED', false, null, { error: this.errorMessage(error) }, adminUserId);
            throw error;
        }
    }
    async getSubscription(preapprovalIdInput, adminUserId) {
        const profile = 'SUBSCRIPTIONS';
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
    async createMarketplaceSplit(adminUserId) {
        const profile = 'MARKETPLACE';
        const config = await this.secretProfile(profile);
        const sellerToken = this.required(config.sellerAccessToken || config.accessToken, 'Informe o Access Token OAuth do vendedor de teste do Marketplace.');
        const payerEmail = this.required(config.payerEmail, 'Informe o e-mail do comprador de teste.');
        const idempotency = (0, crypto_1.randomUUID)();
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
            if (!id)
                throw new common_1.ServiceUnavailableException('O Mercado Pago não retornou o Payment ID do teste de split.');
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
        }
        catch (error) {
            await this.record(profile, 'SPLIT_PIX_CREATED', false, null, { error: this.errorMessage(error) }, adminUserId);
            throw error;
        }
    }
    async getMarketplacePayment(paymentIdInput, adminUserId) {
        const profile = 'MARKETPLACE';
        const paymentId = this.required(paymentIdInput, 'Informe o Payment ID.');
        const config = await this.secretProfile(profile);
        const sellerToken = this.required(config.sellerAccessToken || config.accessToken, 'Informe o Access Token OAuth do vendedor de teste do Marketplace.');
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
            applicationFee: payment?.fee_details?.find?.((item) => item?.type === 'application_fee')?.amount || null,
            externalReference: payment?.external_reference || null,
        };
    }
    async history() {
        return this.dataSource.query(`SELECT id,"profileCode",action,success,"providerResourceId",metadata,"actorUserId","createdAt"
       FROM payment_provider_test_runs
       WHERE "providerCode"='MERCADO_PAGO'
       ORDER BY "createdAt" DESC
       LIMIT 100`).catch(() => []);
    }
    async secretProfile(profile) {
        const rows = await this.dataSource.query(`SELECT "encryptedConfig" FROM payment_provider_test_profiles
       WHERE "providerCode"='MERCADO_PAGO' AND "profileCode"=$1 LIMIT 1`, [profile]);
        if (!rows[0])
            return {};
        return this.vault.decrypt(rows[0].encryptedConfig);
    }
    safeProfile(profile, config, updatedAt) {
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
    profile(value) {
        const profile = String(value || '').trim().toUpperCase();
        if (!['ORDERS', 'SUBSCRIPTIONS', 'MARKETPLACE'].includes(profile)) {
            throw new common_1.BadRequestException('Perfil de teste Mercado Pago inválido.');
        }
        return profile;
    }
    tokenForProfile(profile, config) {
        return this.required(profile === 'MARKETPLACE' ? config.sellerAccessToken || config.accessToken : config.accessToken, profile === 'MARKETPLACE'
            ? 'Informe o Access Token OAuth do vendedor de teste.'
            : 'Informe o Access Token de teste desta aplicação.');
    }
    text(value, max) {
        if (value === undefined)
            return undefined;
        return String(value || '').trim().slice(0, max);
    }
    email(value, current) {
        if (value === undefined)
            return current || '';
        const email = String(value || '').trim().slice(0, 320);
        if (email && !email.includes('@'))
            throw new common_1.BadRequestException('E-mail de teste inválido.');
        return email;
    }
    required(value, message) {
        const text = String(value || '').trim();
        if (!text)
            throw new common_1.BadRequestException(message);
        return text;
    }
    async request(accessToken, method, path, body, idempotencyKey) {
        const headers = {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
        };
        if (body !== undefined)
            headers['Content-Type'] = 'application/json';
        if (idempotencyKey)
            headers['X-Idempotency-Key'] = idempotencyKey;
        const response = await fetch(`https://api.mercadopago.com${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(25_000),
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
            const payload = {
                code: 'MERCADO_PAGO_TEST_ERROR',
                providerStatus: response.status,
                message: `Mercado Pago teste: ${detail}`,
                providerResponse: parsed,
            };
            if (response.status >= 400 && response.status < 500) {
                throw new common_1.BadRequestException(payload);
            }
            throw new common_1.ServiceUnavailableException(payload);
        }
        return parsed;
    }
    async record(profile, action, success, providerResourceId, metadata, actorUserId) {
        await this.dataSource.query(`INSERT INTO payment_provider_test_runs
        ("providerCode","profileCode",action,success,"providerResourceId",metadata,"actorUserId","createdAt")
       VALUES ('MERCADO_PAGO',$1,$2,$3,$4,$5::jsonb,$6,now())`, [profile, action, success, providerResourceId, JSON.stringify(metadata || {}), actorUserId]).catch(() => undefined);
    }
    errorMessage(error) {
        const response = typeof error?.getResponse === 'function' ? error.getResponse() : null;
        const detail = response?.message || response?.providerResponse?.message || response?.providerResponse?.error;
        if (typeof detail === 'string' && detail.trim())
            return detail.trim().slice(0, 500);
        if (error instanceof Error)
            return error.message.slice(0, 500);
        return String(error || 'Erro desconhecido').slice(0, 500);
    }
};
exports.MercadoPagoTestLabService = MercadoPagoTestLabService;
exports.MercadoPagoTestLabService = MercadoPagoTestLabService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        payment_provider_vault_service_1.PaymentProviderVaultService])
], MercadoPagoTestLabService);
//# sourceMappingURL=mercado-pago-test-lab.service.js.map