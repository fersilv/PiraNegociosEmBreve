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
exports.ClassifiedsMarketplaceTermsService = exports.CLASSIFIEDS_PAYMENT_TERMS_VERSION = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
exports.CLASSIFIEDS_PAYMENT_TERMS_VERSION = '2026-08-26';
let ClassifiedsMarketplaceTermsService = class ClassifiedsMarketplaceTermsService {
    dataSource;
    identities;
    constructor(dataSource, identities) {
        this.dataSource = dataSource;
        this.identities = identities;
    }
    async status(uid) {
        const identity = await this.identities.active(uid);
        const buyerKey = this.buyerKey(uid);
        const sellerKey = identity.type === 'COMPANY' ? this.sellerKey(identity.company.id) : null;
        const keys = [buyerKey, sellerKey].filter(Boolean);
        let rows = [];
        if (keys.length) {
            try {
                rows = await this.dataSource.query(`SELECT scope,"identityKey","acceptedAt" FROM classified_marketplace_terms_acceptances
           WHERE version=$1 AND "identityKey" = ANY($2::varchar[])`, [exports.CLASSIFIEDS_PAYMENT_TERMS_VERSION, keys]);
            }
            catch (error) {
                if (!this.isTermsSchemaGap(error))
                    throw error;
                return {
                    version: exports.CLASSIFIEDS_PAYMENT_TERMS_VERSION,
                    termsUrl: '/classificados/termos#pagamentos-online',
                    buyerAccepted: false,
                    sellerAccepted: false,
                    sellerAvailable: Boolean(sellerKey),
                    schemaReady: false,
                    message: 'A estrutura de aceite dos termos de pagamento online ainda não foi migrada neste ambiente.',
                };
            }
        }
        return {
            version: exports.CLASSIFIEDS_PAYMENT_TERMS_VERSION,
            termsUrl: '/classificados/termos#pagamentos-online',
            buyerAccepted: rows.some((row) => row.scope === 'ONLINE_PAYMENT_BUYER' && row.identityKey === buyerKey),
            sellerAccepted: sellerKey
                ? rows.some((row) => row.scope === 'ONLINE_PAYMENT_SELLER' && row.identityKey === sellerKey)
                : false,
            sellerAvailable: Boolean(sellerKey),
            schemaReady: true,
        };
    }
    async accept(uid, rawScope, metadata = {}) {
        const scope = this.scope(rawScope);
        const identity = await this.identities.active(uid);
        let companyId = null;
        let identityKey = this.buyerKey(uid);
        if (scope === 'ONLINE_PAYMENT_SELLER') {
            if (identity.type !== 'COMPANY') {
                throw new common_1.ForbiddenException('O aceite de vendedor exige o workspace Marketplace da empresa.');
            }
            companyId = identity.company.id;
            identityKey = this.sellerKey(companyId);
        }
        try {
            await this.dataSource.query(`INSERT INTO classified_marketplace_terms_acceptances
         ("userId","companyId",scope,version,"identityKey",metadata,"acceptedAt")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())
         ON CONFLICT ("identityKey",scope,version) DO UPDATE SET
           "userId"=EXCLUDED."userId", "companyId"=EXCLUDED."companyId",
           metadata=EXCLUDED.metadata, "acceptedAt"=now()`, [uid, companyId, scope, exports.CLASSIFIEDS_PAYMENT_TERMS_VERSION, identityKey, JSON.stringify(this.safeMetadata(metadata))]);
        }
        catch (error) {
            if (!this.isTermsSchemaGap(error))
                throw error;
            throw new common_1.ServiceUnavailableException({
                code: 'MARKETPLACE_TERMS_SCHEMA_PENDING',
                message: 'Os pagamentos online estão sendo atualizados. Aplique as migrations do Marketplace antes de registrar novos aceites.',
            });
        }
        return { accepted: true, scope, version: exports.CLASSIFIEDS_PAYMENT_TERMS_VERSION, acceptedAt: new Date().toISOString() };
    }
    async assertAccepted(uid, scope) {
        const identity = await this.identities.active(uid);
        const identityKey = scope === 'ONLINE_PAYMENT_SELLER'
            ? identity.type === 'COMPANY'
                ? this.sellerKey(identity.company.id)
                : null
            : this.buyerKey(uid);
        if (!identityKey)
            throw new common_1.ForbiddenException('O aceite de vendedor exige o workspace Marketplace da empresa.');
        let rows = [];
        try {
            rows = await this.dataSource.query(`SELECT id FROM classified_marketplace_terms_acceptances
         WHERE "identityKey"=$1 AND scope=$2 AND version=$3 LIMIT 1`, [identityKey, scope, exports.CLASSIFIEDS_PAYMENT_TERMS_VERSION]);
        }
        catch (error) {
            if (!this.isTermsSchemaGap(error))
                throw error;
            throw new common_1.ServiceUnavailableException({
                code: 'MARKETPLACE_TERMS_SCHEMA_PENDING',
                message: 'Os pagamentos online estão temporariamente indisponíveis porque a estrutura de termos ainda não foi migrada.',
            });
        }
        if (!rows[0]) {
            throw new common_1.BadRequestException(scope === 'ONLINE_PAYMENT_SELLER'
                ? 'Leia e aceite os termos de vendas e pagamentos online antes de habilitar o checkout.'
                : 'Leia e aceite os termos do Marketplace e pagamentos online antes de concluir a compra.');
        }
        return true;
    }
    scope(value) {
        const scope = String(value || '').trim().toUpperCase();
        if (!['ONLINE_PAYMENT_BUYER', 'ONLINE_PAYMENT_SELLER'].includes(scope)) {
            throw new common_1.BadRequestException('Escopo de aceite inválido.');
        }
        return scope;
    }
    buyerKey(uid) {
        return `USER:${uid}`;
    }
    sellerKey(companyId) {
        return `COMPANY:${companyId}`;
    }
    safeMetadata(input) {
        return {
            surface: String(input.surface || '').slice(0, 80) || null,
            userAgent: String(input.userAgent || '').slice(0, 500) || null,
        };
    }
    isTermsSchemaGap(error) {
        const code = String(error?.code || error?.driverError?.code || '');
        if (code === '42P01')
            return true;
        const message = String(error?.message || error?.driverError?.message || '').toLowerCase();
        return message.includes('classified_marketplace_terms_acceptances') && message.includes('does not exist');
    }
};
exports.ClassifiedsMarketplaceTermsService = ClassifiedsMarketplaceTermsService;
exports.ClassifiedsMarketplaceTermsService = ClassifiedsMarketplaceTermsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService])
], ClassifiedsMarketplaceTermsService);
//# sourceMappingURL=classifieds-marketplace-terms.service.js.map