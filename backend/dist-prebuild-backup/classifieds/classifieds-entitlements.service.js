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
exports.ClassifiedsEntitlementsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
let ClassifiedsEntitlementsService = class ClassifiedsEntitlementsService {
    dataSource;
    identities;
    constructor(dataSource, identities) {
        this.dataSource = dataSource;
        this.identities = identities;
    }
    async limits(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY') {
            return {
                photoLimit: 3,
                plan: 'FREE',
                paid: false,
                auctionCreation: false,
            };
        }
        const plan = await this.companyPlan(identity.company.id);
        const paid = plan === 'PLUS' || plan === 'ELITE';
        return {
            photoLimit: 10,
            plan,
            paid,
            auctionCreation: plan === 'ELITE',
        };
    }
    async assertImageLimit(uid, rawImages) {
        if (!Array.isArray(rawImages))
            return this.limits(uid);
        const limits = await this.limits(uid);
        if (rawImages.length > limits.photoLimit) {
            throw new common_1.BadRequestException(limits.photoLimit === 3
                ? 'O plano Free permite até 3 fotos por anúncio. Empresas podem usar até 10 fotos.'
                : `Este workspace permite até ${limits.photoLimit} fotos por anúncio.`);
        }
        return limits;
    }
    async assertAuctionCreation(uid) {
        const identity = await this.identities.active(uid, true);
        if (identity.type !== 'COMPANY') {
            throw new common_1.ForbiddenException('Leilões são exclusivos para empresas no plano Elite.');
        }
        const plan = await this.companyPlan(identity.company.id);
        if (plan !== 'ELITE') {
            throw new common_1.ForbiddenException('Leilões são um recurso exclusivo do plano PiraNegócios Empresa Elite.');
        }
        return { allowed: true, plan, companyId: identity.company.id };
    }
    async assertAuctionParticipant(uid) {
        const identity = await this.identities.active(uid);
        const user = identity.user;
        const missing = [];
        if (!String(user.email || '').trim())
            missing.push('e-mail');
        if (!user.whatsappVerifiedAt || !String(user.whatsappPhoneE164 || '').trim())
            missing.push('WhatsApp verificado');
        if (!String(user.photoURL || '').trim())
            missing.push('foto de perfil com o rosto');
        if (missing.length) {
            throw new common_1.ForbiddenException(`Para participar de leilões, complete seu perfil com ${missing.join(', ')}.`);
        }
        return {
            allowed: true,
            userId: uid,
            email: user.email,
            whatsapp: user.whatsappPhoneE164,
            photoURL: user.photoURL,
        };
    }
    async companyPlan(companyId) {
        const rows = await this.dataSource.query(`SELECT plan FROM company_plan_subscriptions
       WHERE "companyId" = $1
         AND status IN ('ACTIVE','PAST_DUE')
         AND "currentPeriodEnd" > now()
         AND plan IN ('PLUS','ELITE')
       ORDER BY "currentPeriodEnd" DESC LIMIT 1`, [companyId]).catch(() => []);
        const plan = String(rows[0]?.plan || 'FREE').toUpperCase();
        return plan === 'ELITE' ? 'ELITE' : plan === 'PLUS' ? 'PLUS' : 'FREE';
    }
};
exports.ClassifiedsEntitlementsService = ClassifiedsEntitlementsService;
exports.ClassifiedsEntitlementsService = ClassifiedsEntitlementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService])
], ClassifiedsEntitlementsService);
//# sourceMappingURL=classifieds-entitlements.service.js.map