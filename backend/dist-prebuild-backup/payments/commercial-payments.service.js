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
exports.CommercialPaymentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const billing_support_service_1 = require("./billing-support.service");
const payment_checkout_status_service_1 = require("./payment-checkout-status.service");
const payment_provider_manager_service_1 = require("./payment-provider-manager.service");
const payments_service_1 = require("./payments.service");
let CommercialPaymentsService = class CommercialPaymentsService {
    dataSource;
    payments;
    billingSupport;
    providers;
    checkoutStatus;
    commercialProductSchemaReady = null;
    constructor(dataSource, payments, billingSupport, providers, checkoutStatus) {
        this.dataSource = dataSource;
        this.payments = payments;
        this.billingSupport = billingSupport;
        this.providers = providers;
        this.checkoutStatus = checkoutStatus;
    }
    ensureCommercialProductSchema() {
        if (!this.commercialProductSchemaReady) {
            this.commercialProductSchemaReady = (async () => {
                const requiredColumns = [
                    'oneTimePriceCents',
                    'subscriptionPriceCents',
                    'preferredPurchaseMode',
                    'subscriptionBenefits',
                    'oneTimeBenefits',
                ];
                const existing = await this.dataSource.query(`SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = current_schema()
             AND table_name = 'payment_products'
             AND column_name = ANY($1::text[])`, [requiredColumns]);
                if (existing.length === requiredColumns.length)
                    return;
                await this.dataSource.query(`ALTER TABLE payment_products
             ADD COLUMN IF NOT EXISTS "oneTimePriceCents" integer NULL,
             ADD COLUMN IF NOT EXISTS "subscriptionPriceCents" integer NULL,
             ADD COLUMN IF NOT EXISTS "preferredPurchaseMode" varchar(16) NOT NULL DEFAULT 'SUBSCRIPTION',
             ADD COLUMN IF NOT EXISTS "subscriptionBenefits" jsonb NULL,
             ADD COLUMN IF NOT EXISTS "oneTimeBenefits" jsonb NULL`);
                await this.dataSource.query(`UPDATE payment_products
           SET "subscriptionPriceCents" = "priceCents",
               "preferredPurchaseMode" = 'SUBSCRIPTION'
           WHERE "billingType" = 'RECURRING'
             AND "oneTimePriceCents" IS NULL
             AND "subscriptionPriceCents" IS NULL`);
                await this.dataSource.query(`UPDATE payment_products
           SET "oneTimePriceCents" = "priceCents",
               "preferredPurchaseMode" = 'ONE_TIME'
           WHERE "billingType" <> 'RECURRING'
             AND "oneTimePriceCents" IS NULL
             AND "subscriptionPriceCents" IS NULL`);
            })().catch((error) => {
                this.commercialProductSchemaReady = null;
                throw error;
            });
        }
        return this.commercialProductSchemaReady;
    }
    nullablePrice(value, current) {
        if (value === undefined)
            return current === null || current === undefined ? null : Number(current);
        if (value === null || value === '')
            return null;
        const parsed = Math.round(Number(value));
        if (!Number.isFinite(parsed) || parsed < 0)
            throw new common_1.BadRequestException('Preço inválido.');
        return parsed;
    }
    benefitArray(value, current) {
        if (value === undefined) {
            return Array.isArray(current)
                ? Array.from(new Set(current.map((item) => String(item || '').trim()).filter(Boolean)))
                : null;
        }
        if (value === null)
            return null;
        if (!Array.isArray(value))
            throw new common_1.BadRequestException('Benefícios devem ser enviados como uma lista.');
        return Array.from(new Set(value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean)));
    }
    normalizeMode(value) {
        const mode = String(value || '').trim().toUpperCase();
        if (!mode)
            return null;
        if (!['ONE_TIME', 'SUBSCRIPTION'].includes(mode)) {
            throw new common_1.BadRequestException('Modalidade comercial inválida.');
        }
        return mode;
    }
    promotionPrice(product, mode, basePrice) {
        if (String(product.preferredPurchaseMode || '') !== mode)
            return null;
        if (product.promotionalPriceCents === null || product.promotionalPriceCents === undefined)
            return null;
        const promotional = Number(product.promotionalPriceCents);
        if (!Number.isFinite(promotional) || promotional < 0 || promotional > basePrice)
            return null;
        const now = Date.now();
        const starts = product.promotionStartsAt ? new Date(product.promotionStartsAt).getTime() : Number.NEGATIVE_INFINITY;
        const ends = product.promotionEndsAt ? new Date(product.promotionEndsAt).getTime() : Number.POSITIVE_INFINITY;
        if (Number.isNaN(starts) || Number.isNaN(ends) || now < starts || now > ends)
            return null;
        return promotional;
    }
    present(product) {
        const oneTimePriceCents = product.oneTimePriceCents === null || product.oneTimePriceCents === undefined
            ? (product.billingType === 'ONE_TIME' ? Number(product.priceCents || 0) : null)
            : Number(product.oneTimePriceCents);
        const subscriptionPriceCents = product.subscriptionPriceCents === null || product.subscriptionPriceCents === undefined
            ? (product.billingType === 'RECURRING' ? Number(product.priceCents || 0) : null)
            : Number(product.subscriptionPriceCents);
        let preferredPurchaseMode = this.normalizeMode(product.preferredPurchaseMode)
            || (subscriptionPriceCents !== null ? 'SUBSCRIPTION' : 'ONE_TIME');
        if (preferredPurchaseMode === 'SUBSCRIPTION' && subscriptionPriceCents === null)
            preferredPurchaseMode = 'ONE_TIME';
        if (preferredPurchaseMode === 'ONE_TIME' && oneTimePriceCents === null && subscriptionPriceCents !== null)
            preferredPurchaseMode = 'SUBSCRIPTION';
        const oneTimePromo = oneTimePriceCents === null ? null : this.promotionPrice(product, 'ONE_TIME', oneTimePriceCents);
        const subscriptionPromo = subscriptionPriceCents === null ? null : this.promotionPrice(product, 'SUBSCRIPTION', subscriptionPriceCents);
        const subscriptionBenefits = this.benefitArray(undefined, product.subscriptionBenefits);
        const oneTimeBenefits = this.benefitArray(undefined, product.oneTimeBenefits);
        return {
            ...product,
            oneTimePriceCents,
            subscriptionPriceCents,
            subscriptionBenefits,
            oneTimeBenefits,
            preferredPurchaseMode,
            oneTimeAvailable: oneTimePriceCents !== null,
            subscriptionAvailable: subscriptionPriceCents !== null,
            offers: {
                subscription: {
                    mode: 'SUBSCRIPTION',
                    enabled: subscriptionPriceCents !== null,
                    priceCents: subscriptionPriceCents,
                    effectivePriceCents: subscriptionPriceCents === null ? null : subscriptionPromo ?? subscriptionPriceCents,
                    promotionActive: subscriptionPromo !== null,
                    paymentType: 'PIX_AUTOMATICO',
                    recommended: preferredPurchaseMode === 'SUBSCRIPTION',
                    benefitIds: subscriptionBenefits,
                },
                oneTime: {
                    mode: 'ONE_TIME',
                    enabled: oneTimePriceCents !== null,
                    priceCents: oneTimePriceCents,
                    effectivePriceCents: oneTimePriceCents === null ? null : oneTimePromo ?? oneTimePriceCents,
                    promotionActive: oneTimePromo !== null,
                    paymentType: 'PIX',
                    recommended: preferredPurchaseMode === 'ONE_TIME',
                    benefitIds: oneTimeBenefits,
                },
            },
        };
    }
    async listProducts(includeDisabled = false) {
        const rows = await this.dataSource.query(`SELECT * FROM payment_products ${includeDisabled ? '' : 'WHERE enabled = true'} ORDER BY "sortOrder" ASC, name ASC`);
        return rows.map((row) => this.present(row));
    }
    async getProduct(code, includeDisabled = false) {
        const rows = await this.dataSource.query(`SELECT * FROM payment_products WHERE code = $1 ${includeDisabled ? '' : 'AND enabled = true'} LIMIT 1`, [String(code || '').trim()]);
        if (!rows[0])
            throw new common_1.NotFoundException('Produto não encontrado ou indisponível.');
        return this.present(rows[0]);
    }
    async updateProduct(code, input) {
        await this.ensureCommercialProductSchema();
        const current = await this.getProduct(code, true);
        const oneTimePriceCents = this.nullablePrice(input.oneTimePriceCents, current.oneTimePriceCents);
        const subscriptionPriceCents = this.nullablePrice(input.subscriptionPriceCents, current.subscriptionPriceCents);
        if (oneTimePriceCents === null && subscriptionPriceCents === null) {
            throw new common_1.BadRequestException('O produto precisa ter pelo menos uma modalidade comercial disponível.');
        }
        const subscriptionBenefits = this.benefitArray(input.subscriptionBenefits, current.subscriptionBenefits);
        const oneTimeBenefits = this.benefitArray(input.oneTimeBenefits, current.oneTimeBenefits);
        let preferredPurchaseMode = this.normalizeMode(input.preferredPurchaseMode)
            || current.preferredPurchaseMode;
        if (preferredPurchaseMode === 'SUBSCRIPTION' && subscriptionPriceCents === null)
            preferredPurchaseMode = 'ONE_TIME';
        if (preferredPurchaseMode === 'ONE_TIME' && oneTimePriceCents === null)
            preferredPurchaseMode = 'SUBSCRIPTION';
        const legacyPrice = preferredPurchaseMode === 'SUBSCRIPTION'
            ? Number(subscriptionPriceCents)
            : Number(oneTimePriceCents);
        const legacyBillingType = preferredPurchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME';
        const rows = await this.dataSource.query(`UPDATE payment_products
       SET "oneTimePriceCents" = $2,
           "subscriptionPriceCents" = $3,
           "preferredPurchaseMode" = $4,
           "priceCents" = $5,
           "billingType" = $6,
           "subscriptionBenefits" = $7::jsonb,
           "oneTimeBenefits" = $8::jsonb,
           "updatedAt" = now()
       WHERE code = $1
       RETURNING *`, [
            code,
            oneTimePriceCents,
            subscriptionPriceCents,
            preferredPurchaseMode,
            legacyPrice,
            legacyBillingType,
            subscriptionBenefits === null ? null : JSON.stringify(subscriptionBenefits),
            oneTimeBenefits === null ? null : JSON.stringify(oneTimeBenefits),
        ]);
        return this.present(rows[0]);
    }
    chooseMode(product, requested) {
        const requestedMode = this.normalizeMode(requested);
        const mode = requestedMode
            || product.preferredPurchaseMode
            || (product.subscriptionAvailable ? 'SUBSCRIPTION' : 'ONE_TIME');
        if (mode === 'SUBSCRIPTION' && !product.subscriptionAvailable) {
            throw new common_1.BadRequestException('Este produto não possui oferta por assinatura.');
        }
        if (mode === 'ONE_TIME' && !product.oneTimeAvailable) {
            throw new common_1.BadRequestException('Este produto não possui oferta para compra avulsa.');
        }
        return mode;
    }
    async createCheckout(userId, productCode, purchaseModeInput, payer = {}) {
        const product = await this.getProduct(productCode, false);
        const purchaseMode = this.chooseMode(product, purchaseModeInput);
        const lifetimeActivation = await this.billingSupport.activateLifetimeProduct(userId, product.code);
        if (lifetimeActivation) {
            return {
                ...lifetimeActivation,
                purchaseMode,
                paymentRequired: false,
                checkoutReady: false,
                message: 'Conta vitalícia: este recurso não exige pagamento.',
            };
        }
        const offer = purchaseMode === 'SUBSCRIPTION' ? product.offers.subscription : product.offers.oneTime;
        const basePrice = Number(offer.priceCents);
        const amountCents = Number(offer.effectivePriceCents);
        if (!Number.isFinite(basePrice) || !Number.isFinite(amountCents) || basePrice <= 0 || amountCents <= 0) {
            throw new common_1.BadRequestException('Esta modalidade não possui um preço válido para cobrança.');
        }
        const discountCents = Math.max(0, basePrice - amountCents);
        const inserted = await this.dataSource.query(`INSERT INTO payments
        ("userId", "productCode", method, status, "originalAmountCents", "amountCents", "discountCents", provider, "purchaseMode", metadata)
       VALUES ($1, $2, 'PIX', 'PENDING', $3, $4, $5, NULL, $6, $7::jsonb)
       RETURNING *`, [
            userId,
            product.code,
            basePrice,
            amountCents,
            discountCents,
            purchaseMode,
            JSON.stringify({
                purchaseMode,
                paymentType: offer.paymentType,
                promotionActive: offer.promotionActive === true,
                benefitIds: offer.benefitIds,
            }),
        ]);
        const payment = inserted[0];
        const paymentId = String(payment.id);
        const devMode = await this.payments.getDevMode();
        if (devMode.enabled) {
            const settled = await this.payments.simulatePayment(paymentId, userId);
            return {
                ...payment,
                ...settled,
                id: paymentId,
                paymentId,
                purchaseMode,
                product,
                paymentRequired: false,
                checkoutReady: false,
                devSimulation: true,
            };
        }
        try {
            const providerPayment = {
                ...payment,
                purchaseMode,
                product: {
                    ...product,
                    billingType: purchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME',
                    priceCents: basePrice,
                    effectivePriceCents: amountCents,
                },
            };
            const checkout = await this.providers.createCheckout(providerPayment, payer);
            const stored = await this.payments.attachProviderCheckout(paymentId, checkout);
            const metadata = typeof stored.metadata === 'object' && stored.metadata ? stored.metadata : {};
            const response = {
                ...stored,
                id: paymentId,
                paymentId,
                purchaseMode,
                billingType: purchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME',
                product: providerPayment.product,
                checkoutReady: Boolean(stored.pixCopyPaste
                    || stored.qrCodeBase64
                    || metadata.ticketUrl
                    || metadata.subscriptionCheckoutUrl),
                providerConfigured: true,
                paymentRequired: true,
            };
            this.checkoutStatus.watchForUser(userId, paymentId);
            return response;
        }
        catch (error) {
            await this.payments.cancelProviderCheckout(paymentId, error).catch(() => undefined);
            throw error;
        }
    }
};
exports.CommercialPaymentsService = CommercialPaymentsService;
exports.CommercialPaymentsService = CommercialPaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        payments_service_1.PaymentsService,
        billing_support_service_1.BillingSupportService,
        payment_provider_manager_service_1.PaymentProviderManagerService,
        payment_checkout_status_service_1.PaymentCheckoutStatusService])
], CommercialPaymentsService);
//# sourceMappingURL=commercial-payments.service.js.map