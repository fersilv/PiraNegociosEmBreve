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
exports.ClassifiedsReceiptPreferencesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
let ClassifiedsReceiptPreferencesService = class ClassifiedsReceiptPreferencesService {
    dataSource;
    identities;
    constructor(dataSource, identities) {
        this.dataSource = dataSource;
        this.identities = identities;
    }
    async get(uid) {
        const identity = await this.assertCompany(uid);
        const companyId = identity.company.id;
        const [rows, connections, companyRows] = await Promise.all([
            this.dataSource.query(`SELECT * FROM company_classified_receipt_preferences WHERE "companyId"=$1 LIMIT 1`, [companyId]).catch(() => []),
            this.dataSource.query(`SELECT provider,status,"externalUserId","connectedAt","updatedAt" FROM company_classified_payment_connections WHERE "companyId"=$1 ORDER BY provider`, [companyId]).catch(() => []),
            this.dataSource.query(`SELECT id,name,address,city,state,"isVerified","verificationStatus" FROM companies WHERE id=$1 LIMIT 1`, [companyId]),
        ]);
        const row = rows[0] || null;
        const company = companyRows[0] || identity.company;
        return {
            companyId,
            companyVerified: Boolean(company?.isVerified || company?.verificationStatus === 'VERIFIED'),
            companyAddress: this.companyAddress(company),
            provider: row?.provider || 'MERCADO_PAGO',
            pixEnabled: row ? row.pixEnabled !== false : true,
            cardEnabled: row ? row.cardEnabled !== false : true,
            cardMaxInstallments: this.installments(row?.cardMaxInstallments ?? 12),
            auctionFeePayerDefault: this.feePayer(row?.auctionFeePayerDefault),
            pickupEnabled: row ? row.pickupEnabled !== false : true,
            deliveryEnabled: row?.deliveryEnabled === true,
            arrangeEnabled: row ? row.arrangeEnabled !== false : true,
            onlineCheckoutDefault: row ? row.onlineCheckoutDefault === true : false,
            paymentConnections: connections,
            mercadoPagoConnected: connections.some((item) => item.provider === 'MERCADO_PAGO' && item.status === 'CONNECTED'),
        };
    }
    async update(uid, body) {
        const identity = await this.assertCompany(uid);
        const companyId = identity.company.id;
        const pixEnabled = body.pixEnabled !== false;
        const cardEnabled = body.cardEnabled !== false;
        if (!pixEnabled && !cardEnabled)
            throw new common_1.BadRequestException('Habilite pelo menos Pix ou cartão.');
        const cardMaxInstallments = this.installments(body.cardMaxInstallments ?? 12);
        const auctionFeePayerDefault = this.feePayer(body.auctionFeePayerDefault);
        const pickupEnabled = body.pickupEnabled !== false;
        const deliveryEnabled = body.deliveryEnabled === true;
        const arrangeEnabled = body.arrangeEnabled !== false;
        const onlineCheckoutDefault = body.onlineCheckoutDefault === true;
        if (!pickupEnabled && !deliveryEnabled && !arrangeEnabled) {
            throw new common_1.BadRequestException('Habilite pelo menos uma forma de entrega ou retirada.');
        }
        await this.dataSource.query(`INSERT INTO company_classified_receipt_preferences
        ("companyId",provider,"pixEnabled","cardEnabled","cardMaxInstallments","auctionFeePayerDefault","pickupEnabled","deliveryEnabled","arrangeEnabled","onlineCheckoutDefault","updatedAt")
       VALUES ($1,'MERCADO_PAGO',$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT ("companyId",provider) DO UPDATE SET
        "pixEnabled"=EXCLUDED."pixEnabled",
        "cardEnabled"=EXCLUDED."cardEnabled",
        "cardMaxInstallments"=EXCLUDED."cardMaxInstallments",
        "auctionFeePayerDefault"=EXCLUDED."auctionFeePayerDefault",
        "pickupEnabled"=EXCLUDED."pickupEnabled",
        "deliveryEnabled"=EXCLUDED."deliveryEnabled",
        "arrangeEnabled"=EXCLUDED."arrangeEnabled",
        "onlineCheckoutDefault"=EXCLUDED."onlineCheckoutDefault",
        "updatedAt"=now()`, [companyId, pixEnabled, cardEnabled, cardMaxInstallments, auctionFeePayerDefault, pickupEnabled, deliveryEnabled, arrangeEnabled, onlineCheckoutDefault]);
        return this.get(uid);
    }
    methodsFrom(body, fallback) {
        const explicit = Array.isArray(body.paymentMethods)
            ? body.paymentMethods.map(String).map((value) => value.toUpperCase()).filter((value) => value === 'PIX' || value === 'CARD')
            : [];
        const unique = [...new Set(explicit)];
        if (unique.length)
            return unique;
        const defaults = [];
        if (fallback?.pixEnabled !== false)
            defaults.push('PIX');
        if (fallback?.cardEnabled !== false)
            defaults.push('CARD');
        return defaults.length ? defaults : ['PIX'];
    }
    fulfillmentFrom(body, fallback) {
        const explicit = Array.isArray(body.fulfillmentModes)
            ? body.fulfillmentModes.map(String).map((value) => value.toUpperCase()).filter((value) => ['ARRANGE', 'PICKUP', 'DELIVERY'].includes(value))
            : [];
        const unique = [...new Set(explicit)];
        if (unique.length)
            return unique;
        const defaults = [];
        if (fallback?.arrangeEnabled !== false)
            defaults.push('ARRANGE');
        if (fallback?.pickupEnabled !== false)
            defaults.push('PICKUP');
        if (fallback?.deliveryEnabled === true)
            defaults.push('DELIVERY');
        return defaults.length ? defaults : ['ARRANGE'];
    }
    feePayer(value) {
        return String(value || '').toUpperCase() === 'BUYER' ? 'BUYER' : 'SELLER';
    }
    installments(value) {
        const parsed = Math.floor(Number(value));
        if (!Number.isFinite(parsed))
            return 12;
        return Math.max(1, Math.min(24, parsed));
    }
    companyAddress(company) {
        const address = String(company?.address || '').trim();
        const city = String(company?.city || '').trim();
        const state = String(company?.state || '').trim().toUpperCase();
        if (!address)
            return [city, state].filter(Boolean).join('/');
        const cityState = [city, state].filter(Boolean).join('/');
        if (!cityState || address.toLowerCase().includes(city.toLowerCase()))
            return address;
        return `${address}, ${cityState}`;
    }
    async assertCompany(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('As formas de recebimento pertencem ao workspace Business.');
        return identity;
    }
};
exports.ClassifiedsReceiptPreferencesService = ClassifiedsReceiptPreferencesService;
exports.ClassifiedsReceiptPreferencesService = ClassifiedsReceiptPreferencesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService])
], ClassifiedsReceiptPreferencesService);
//# sourceMappingURL=classifieds-receipt-preferences.service.js.map