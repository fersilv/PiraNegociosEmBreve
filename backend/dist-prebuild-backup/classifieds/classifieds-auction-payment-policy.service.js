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
exports.ClassifiedsAuctionPaymentPolicyService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const classifieds_auction_settlement_service_1 = require("./classifieds-auction-settlement.service");
const classifieds_entitlements_service_1 = require("./classifieds-entitlements.service");
const classifieds_marketplace_payments_service_1 = require("./classifieds-marketplace-payments.service");
const classifieds_receipt_preferences_service_1 = require("./classifieds-receipt-preferences.service");
let ClassifiedsAuctionPaymentPolicyService = class ClassifiedsAuctionPaymentPolicyService {
    dataSource;
    settlement;
    entitlements;
    marketplacePayments;
    receiptPreferences;
    constructor(dataSource, settlement, entitlements, marketplacePayments, receiptPreferences) {
        this.dataSource = dataSource;
        this.settlement = settlement;
        this.entitlements = entitlements;
        this.marketplacePayments = marketplacePayments;
        this.receiptPreferences = receiptPreferences;
    }
    async defaults(uid) {
        const prefs = await this.receiptPreferences.get(uid);
        const plan = await this.entitlements.companyPlan(prefs.companyId);
        const feeRule = await this.settlement.resolveAuctionFeeRule(prefs.companyId, plan);
        return {
            ...prefs,
            plan,
            feeRule,
            auctionFeePayer: prefs.auctionFeePayerDefault,
            paymentMethods: this.methods(null, prefs),
            fulfillmentModes: this.defaultFulfillment(prefs),
            feeDisclosure: feeRule
                ? `Taxa de leilão vigente: ${Number(feeRule.percentage || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%.`
                : 'A taxa de leilão ainda não foi configurada no Admin.',
        };
    }
    async sellerConfig(uid, auctionId) {
        const base = await this.settlement.sellerConfig(uid, auctionId);
        const row = await this.policy(auctionId);
        const prefs = await this.receiptPreferences.get(uid);
        return {
            ...base,
            auctionFeePayer: this.receiptPreferences.feePayer(row?.auctionFeePayer || prefs.auctionFeePayerDefault),
            paymentMethods: this.methods(row?.paymentMethods, prefs),
            cardMaxInstallments: this.receiptPreferences.installments(row?.cardMaxInstallments || prefs.cardMaxInstallments),
            pickupAddress: row?.pickupAddressSnapshot || prefs.companyAddress || null,
            feeSnapshot: row?.auctionFeeRateBps == null ? base?.feeRule || null : {
                source: row.auctionFeeSource || null,
                rateBps: Number(row.auctionFeeRateBps),
                percentage: Number(row.auctionFeeRateBps) / 100,
                minimumFeeCents: Number(row.auctionFeeMinimumCents || 0),
                maximumFeeCents: row.auctionFeeMaximumCents == null ? null : Number(row.auctionFeeMaximumCents),
            },
        };
    }
    async configureSeller(uid, auctionId, body) {
        const prefs = await this.receiptPreferences.get(uid);
        const paymentMethods = this.receiptPreferences.methodsFrom(body, prefs);
        const fulfillmentModes = this.receiptPreferences.fulfillmentFrom(body, prefs);
        const cardMaxInstallments = this.receiptPreferences.installments(body.cardMaxInstallments ?? prefs.cardMaxInstallments);
        const auctionFeePayer = this.receiptPreferences.feePayer(body.auctionFeePayer ?? prefs.auctionFeePayerDefault);
        const base = await this.settlement.configureSeller(uid, auctionId, { ...body, fulfillmentModes });
        const fee = base?.feeRule || null;
        await this.dataSource.query(`UPDATE classified_auctions SET
        "auctionFeePayer"=$2,"paymentMethods"=$3::jsonb,"cardMaxInstallments"=$4,
        "pickupAddressSnapshot"=$5,
        "auctionFeeRateBps"=CASE WHEN $6 THEN $7 ELSE "auctionFeeRateBps" END,
        "auctionFeeMinimumCents"=CASE WHEN $6 THEN $8 ELSE "auctionFeeMinimumCents" END,
        "auctionFeeMaximumCents"=CASE WHEN $6 THEN $9 ELSE "auctionFeeMaximumCents" END,
        "auctionFeeSource"=CASE WHEN $6 THEN $10 ELSE "auctionFeeSource" END,
        "updatedAt"=now() WHERE id=$1`, [auctionId, auctionFeePayer, JSON.stringify(paymentMethods), cardMaxInstallments, prefs.companyAddress || null,
            base?.onlinePaymentEnabled === true && Boolean(fee), fee?.rateBps ?? null, fee?.minimumFeeCents ?? 0,
            fee?.maximumFeeCents ?? null, fee?.source ?? null]);
        return this.sellerConfig(uid, auctionId);
    }
    async buyerConfig(uid, auctionId) {
        const base = await this.settlement.buyerConfig(uid, auctionId);
        const row = await this.policy(auctionId);
        if (!row)
            return base;
        const sellerCredentials = await this.marketplacePayments.sellerMercadoPagoCredentials(row.companyId);
        const publicKey = String(sellerCredentials.publicKey || base.publicKey || '').trim();
        if (this.methods(row.paymentMethods).includes('CARD') && !publicKey) {
            throw new common_1.ServiceUnavailableException('A conta Mercado Pago da empresa precisa ser reconectada para liberar pagamentos por cartão.');
        }
        const feeCents = this.fee(Number(base.amountCents || 0), row);
        const feePayer = this.receiptPreferences.feePayer(row.auctionFeePayer);
        const buyerFeeCents = feePayer === 'BUYER' ? feeCents : 0;
        return {
            ...base,
            publicKey: publicKey || base.publicKey,
            paymentMethods: this.methods(row.paymentMethods),
            cardMaxInstallments: this.receiptPreferences.installments(row.cardMaxInstallments || 12),
            pickupAddress: this.fulfillment(row.fulfillmentModes).includes('PICKUP') ? row.pickupAddressSnapshot || row.companyAddress || null : null,
            auctionFeePayer: feePayer,
            auctionFeeCents: feeCents,
            buyerAuctionFeeCents: buyerFeeCents,
            totalCents: Number(base.amountCents || 0) + Number(base.deliveryFeeCents || 0) + buyerFeeCents,
            feeDisclosure: this.disclosure(feePayer, row, feeCents),
        };
    }
    async createPayment(uid, auctionId, body) {
        const row = await this.policy(auctionId);
        if (!row)
            throw new common_1.BadRequestException('Configuração do leilão não encontrada.');
        const method = String(body.paymentMethod || '').toUpperCase();
        const allowed = this.methods(row.paymentMethods);
        if (!allowed.includes(method))
            throw new common_1.BadRequestException('A empresa não habilitou esta forma de pagamento para o arremate.');
        const next = { ...body };
        if (method === 'CARD') {
            const max = this.receiptPreferences.installments(row.cardMaxInstallments || 12);
            const installments = Math.max(1, Math.floor(Number(body.installments || body.formData?.installments || 1)));
            if (installments > max)
                throw new common_1.BadRequestException(`Este leilão aceita cartão em até ${max}x.`);
            next.installments = installments;
            next.formData = { ...(body.formData || {}), installments };
        }
        return this.settlement.createPayment(uid, auctionId, next);
    }
    async policy(auctionId) {
        const rows = await this.dataSource.query(`SELECT a.*,c.address AS "companyAddress",c.city AS "companyCity",c.state AS "companyState"
       FROM classified_auctions a JOIN companies c ON c.id=a."companyId" WHERE a.id=$1 LIMIT 1`, [auctionId]).catch(() => []);
        const row = rows[0] || null;
        if (row && !row.pickupAddressSnapshot) {
            row.companyAddress = [row.companyAddress, [row.companyCity, row.companyState].filter(Boolean).join('/')].filter(Boolean).join(', ');
        }
        return row;
    }
    methods(value, fallback) {
        const raw = Array.isArray(value) ? value.map(String).map(v => v.toUpperCase()) : [];
        const values = [...new Set(raw.filter(v => v === 'PIX' || v === 'CARD'))];
        if (values.length)
            return values;
        const defaults = [];
        if (fallback?.pixEnabled !== false)
            defaults.push('PIX');
        if (fallback?.cardEnabled !== false)
            defaults.push('CARD');
        return defaults.length ? defaults : ['PIX', 'CARD'];
    }
    defaultFulfillment(prefs) {
        const values = [];
        if (prefs.arrangeEnabled !== false)
            values.push('ARRANGE');
        if (prefs.pickupEnabled !== false)
            values.push('PICKUP');
        if (prefs.deliveryEnabled === true)
            values.push('DELIVERY');
        return values.length ? values : ['ARRANGE'];
    }
    fulfillment(value) {
        const raw = Array.isArray(value) ? value.map(String).map(v => v.toUpperCase()) : [];
        const values = [...new Set(raw.filter(v => ['ARRANGE', 'PICKUP', 'DELIVERY'].includes(v)))];
        return values.length ? values : ['ARRANGE'];
    }
    fee(baseCents, row) {
        let value = Math.round(Math.max(0, baseCents) * Number(row.auctionFeeRateBps || 0) / 10000);
        value = Math.max(Number(row.auctionFeeMinimumCents || 0), value);
        if (row.auctionFeeMaximumCents != null)
            value = Math.min(Number(row.auctionFeeMaximumCents), value);
        return Math.max(0, Math.min(baseCents, value));
    }
    disclosure(payer, row, feeCents) {
        if (payer === 'SELLER')
            return 'A empresa absorve a taxa de leilão. O arrematante paga o valor vencedor e eventual entrega.';
        const percentage = Number(row.auctionFeeRateBps || 0) / 100;
        return `Arremate + taxa de leilão de ${percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% (${(feeCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no valor final), além de eventual entrega.`;
    }
};
exports.ClassifiedsAuctionPaymentPolicyService = ClassifiedsAuctionPaymentPolicyService;
exports.ClassifiedsAuctionPaymentPolicyService = ClassifiedsAuctionPaymentPolicyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_auction_settlement_service_1.ClassifiedsAuctionSettlementService,
        classifieds_entitlements_service_1.ClassifiedsEntitlementsService,
        classifieds_marketplace_payments_service_1.ClassifiedsMarketplacePaymentsService,
        classifieds_receipt_preferences_service_1.ClassifiedsReceiptPreferencesService])
], ClassifiedsAuctionPaymentPolicyService);
//# sourceMappingURL=classifieds-auction-payment-policy.service.js.map