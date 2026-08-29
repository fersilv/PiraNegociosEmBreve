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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifiedsIdentityService = exports.CLASSIFIEDS_TERMS_VERSION = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const company_entity_1 = require("../companies/entities/company.entity");
const user_entity_1 = require("../users/entities/user.entity");
const classified_user_preference_entity_1 = require("./entities/classified-user-preference.entity");
const company_classified_profile_entity_1 = require("./entities/company-classified-profile.entity");
exports.CLASSIFIEDS_TERMS_VERSION = '2026-08-25';
const CHANNELS = ['CLASSIFIEDS', 'COMPANY_PAGE'];
let ClassifiedsIdentityService = class ClassifiedsIdentityService {
    preferences;
    companyProfiles;
    users;
    companies;
    dataSource;
    constructor(preferences, companyProfiles, users, companies, dataSource) {
        this.preferences = preferences;
        this.companyProfiles = companyProfiles;
        this.users = users;
        this.companies = companies;
        this.dataSource = dataSource;
    }
    async context(uid) {
        const { user, company, companyEligible, companyVerified } = await this.baseContext(uid);
        const [preference, companyProfile] = await Promise.all([
            this.preferences.findOne({ where: { userId: uid } }),
            company?.id ? this.companyProfiles.findOne({ where: { companyId: company.id } }) : Promise.resolve(null),
        ]);
        const personalTermsAccepted = Boolean(preference?.personalTermsAcceptedAt && preference.personalTermsVersion === exports.CLASSIFIEDS_TERMS_VERSION);
        const companyTermsAccepted = Boolean(companyProfile?.termsAcceptedAt && companyProfile.termsVersion === exports.CLASSIFIEDS_TERMS_VERSION);
        const hasTwoFaces = Boolean(company && companyEligible);
        const remembered = preference?.lastIdentityType || null;
        let activeIdentity = remembered;
        if (!hasTwoFaces && !activeIdentity)
            activeIdentity = 'PERSONAL';
        if (activeIdentity === 'COMPANY' && (!company || !companyEligible))
            activeIdentity = 'PERSONAL';
        return {
            termsVersion: exports.CLASSIFIEDS_TERMS_VERSION,
            needsIdentitySelection: hasTwoFaces && !remembered,
            activeIdentity,
            personal: {
                available: true,
                termsAccepted: personalTermsAccepted,
                termsAcceptedAt: personalTermsAccepted ? preference?.personalTermsAcceptedAt || null : null,
                name: user.socialName || user.displayName || user.fullName || 'Meu perfil',
                photoURL: user.photoURL || null,
            },
            company: company ? {
                id: company.id,
                name: company.name,
                logoURL: company.logoURL,
                available: companyEligible,
                verified: companyVerified,
                termsAccepted: companyTermsAccepted,
                requiresOnboarding: false,
                publishingSetupRequired: companyEligible && (!companyVerified || !companyTermsAccepted),
                canSellProducts: companyProfile?.canSellProducts ?? true,
                canOfferServices: companyProfile?.canOfferServices ?? false,
                businessSegments: companyProfile?.businessSegments || [],
                defaultPublicationChannels: companyProfile?.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE'],
                pageSectionLabel: companyProfile?.pageSectionLabel || null,
            } : null,
        };
    }
    async select(uid, identityRaw) {
        const identity = String(identityRaw || '').toUpperCase();
        if (!['PERSONAL', 'COMPANY'].includes(identity))
            throw new common_1.BadRequestException('Identidade inválida.');
        const { company, companyEligible } = await this.baseContext(uid);
        if (identity === 'COMPANY' && (!company || !companyEligible))
            throw new common_1.ForbiddenException('Você não tem permissão para usar esta empresa no Marketplace.');
        let preference = await this.preferences.findOne({ where: { userId: uid } });
        if (!preference)
            preference = this.preferences.create({ userId: uid });
        preference.lastIdentityType = identity;
        preference.lastCompanyId = identity === 'COMPANY' ? company.id : null;
        await this.preferences.save(preference);
        return this.context(uid);
    }
    async acceptPersonalTerms(uid, accepted) {
        if (accepted !== true)
            throw new common_1.BadRequestException('É necessário aceitar os Termos de Uso do Marketplace para publicar.');
        await this.baseContext(uid);
        let preference = await this.preferences.findOne({ where: { userId: uid } });
        if (!preference)
            preference = this.preferences.create({ userId: uid });
        preference.personalTermsVersion = exports.CLASSIFIEDS_TERMS_VERSION;
        preference.personalTermsAcceptedAt = new Date();
        preference.lastIdentityType = preference.lastIdentityType || 'PERSONAL';
        await this.preferences.save(preference);
        return this.context(uid);
    }
    async configureCompany(uid, body) {
        const { company, companyEligible, companyVerified } = await this.baseContext(uid);
        if (!company || !companyEligible)
            throw new common_1.ForbiddenException('Você não pode configurar o Marketplace desta empresa.');
        if (!companyVerified)
            throw new common_1.ForbiddenException('A empresa precisa estar verificada para publicar no Marketplace.');
        let profile = await this.companyProfiles.findOne({ where: { companyId: company.id } });
        const hasCurrentTerms = Boolean(profile?.termsAcceptedAt && profile.termsVersion === exports.CLASSIFIEDS_TERMS_VERSION);
        if (body.acceptedTerms !== true && !hasCurrentTerms)
            throw new common_1.BadRequestException('Aceite os Termos de Uso do Marketplace antes da primeira publicação.');
        if (!profile)
            profile = this.companyProfiles.create({ companyId: company.id });
        const canSellProducts = body.canSellProducts !== undefined ? Boolean(body.canSellProducts) : profile.canSellProducts;
        const canOfferServices = body.canOfferServices !== undefined ? Boolean(body.canOfferServices) : profile.canOfferServices;
        if (!canSellProducts && !canOfferServices)
            throw new common_1.BadRequestException('Marque venda de produtos, prestação de serviços ou as duas opções.');
        profile.status = 'ACTIVE';
        profile.canSellProducts = canSellProducts;
        profile.canOfferServices = canOfferServices;
        if (body.businessSegments !== undefined)
            profile.businessSegments = cleanSegments(body.businessSegments);
        else if (!Array.isArray(profile.businessSegments))
            profile.businessSegments = [];
        if (body.defaultPublicationChannels !== undefined)
            profile.defaultPublicationChannels = cleanChannels(body.defaultPublicationChannels, profile.defaultPublicationChannels || ['CLASSIFIEDS', 'COMPANY_PAGE']);
        else if (!profile.defaultPublicationChannels?.length)
            profile.defaultPublicationChannels = ['CLASSIFIEDS', 'COMPANY_PAGE'];
        if (body.pageSectionLabel !== undefined)
            profile.pageSectionLabel = cleanNullable(body.pageSectionLabel, 80);
        if (body.acceptedTerms === true) {
            profile.termsVersion = exports.CLASSIFIEDS_TERMS_VERSION;
            profile.termsAcceptedAt = new Date();
            profile.termsAcceptedByUserId = uid;
        }
        await this.companyProfiles.save(profile);
        let preference = await this.preferences.findOne({ where: { userId: uid } });
        if (!preference)
            preference = this.preferences.create({ userId: uid });
        preference.lastIdentityType = 'COMPANY';
        preference.lastCompanyId = company.id;
        await this.preferences.save(preference);
        return this.context(uid);
    }
    async active(uid, requireReady = false) {
        const { user, company, companyEligible, companyVerified } = await this.baseContext(uid);
        const preference = await this.preferences.findOne({ where: { userId: uid } });
        const hasTwoFaces = Boolean(company && companyEligible);
        let type = preference?.lastIdentityType || (hasTwoFaces ? null : 'PERSONAL');
        if (!type)
            throw new common_1.BadRequestException('Escolha se deseja usar o Marketplace como perfil pessoal ou como empresa.');
        if (type === 'PERSONAL') {
            const currentTerms = Boolean(preference?.personalTermsAcceptedAt && preference.personalTermsVersion === exports.CLASSIFIEDS_TERMS_VERSION);
            if (requireReady && !currentTerms)
                throw new common_1.ForbiddenException('Aceite os Termos de Uso do Marketplace antes da sua primeira publicação.');
            return { type, user, company: null, companyProfile: null };
        }
        if (!company || !companyEligible)
            throw new common_1.ForbiddenException('A identidade da empresa não está disponível para sua conta no Marketplace.');
        const companyProfile = await this.companyProfiles.findOne({ where: { companyId: company.id } });
        const companyTermsCurrent = Boolean(companyProfile?.termsAcceptedAt && companyProfile.termsVersion === exports.CLASSIFIEDS_TERMS_VERSION);
        if (requireReady && !companyVerified)
            throw new common_1.ForbiddenException('A empresa precisa estar verificada antes de publicar no Marketplace.');
        if (requireReady && (!companyTermsCurrent || companyProfile?.status !== 'ACTIVE'))
            throw new common_1.ForbiddenException('Conclua a adesão ao Marketplace e aceite os termos antes da primeira publicação.');
        return { type, user, company, companyProfile };
    }
    async assertPublishingReady(uid) { return this.active(uid, true); }
    async assertCompanyOperator(uid, companyId) {
        const user = await this.users.findOne({ where: { id: uid } });
        const company = await this.companies.findOne({ where: { id: companyId } });
        if (!user || !company)
            throw new common_1.ForbiddenException('Empresa ou usuário não encontrado.');
        if (company.ownerId === uid)
            return { user, company };
        const membership = await this.membership(uid, companyId);
        if (!membership || (membership.role !== 'PRIMARY_ADMIN' && membership.role !== 'ADMIN' && membership.permissions?.marketplace !== true))
            throw new common_1.ForbiddenException('Seu perfil não tem permissão para administrar o Marketplace desta empresa.');
        return { user, company };
    }
    async baseContext(uid) {
        const user = await this.users.findOne({ where: { id: uid } });
        if (!user)
            throw new common_1.ForbiddenException('Usuário não encontrado.');
        let company = user.companyId ? await this.companies.findOne({ where: { id: user.companyId } }) : null;
        if (!company)
            company = await this.companies.findOne({ where: { ownerId: uid } });
        if (!company) {
            const rows = await this.dataSource.query(`SELECT c.*
         FROM company_memberships m
         JOIN companies c ON c.id=m."companyId"
         WHERE m."userId"=$1 AND m.status='ACTIVE'
         ORDER BY CASE m.role WHEN 'PRIMARY_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,m."updatedAt" DESC
         LIMIT 1`, [uid]).catch(() => []);
            if (rows[0]?.id)
                company = rows[0];
        }
        let membership = company ? await this.membership(uid, company.id) : null;
        const legacyCompanyAdmin = Boolean(company && !membership && user.companyId === company.id && user.isCompanyAdmin);
        if (company && legacyCompanyAdmin) {
            const permissions = {
                companyProfile: true,
                recruitment: true,
                marketplace: true,
                finance: true,
                team: true,
            };
            const role = company.ownerId === uid ? 'PRIMARY_ADMIN' : 'ADMIN';
            const rows = await this.dataSource.query(`INSERT INTO company_memberships("companyId","userId",role,"isPartner",permissions,status)
         VALUES ($1,$2,$3,false,$4::jsonb,'ACTIVE')
         ON CONFLICT ("companyId","userId") DO UPDATE SET
           role=EXCLUDED.role,
           status='ACTIVE',
           permissions=COALESCE(company_memberships.permissions,'{}'::jsonb) || EXCLUDED.permissions,
           "updatedAt"=now()
         RETURNING role,permissions,status`, [company.id, uid, role, JSON.stringify(permissions)]).catch(() => []);
            membership = rows[0] || null;
        }
        if (company && !user.companyId && (company.ownerId === uid || membership)) {
            await this.dataSource.query(`UPDATE users SET "companyId"=$2,"companyName"=$3,"isCompanyAdmin"=$4,"updatedAt"=now() WHERE id=$1`, [uid, company.id, company.name, company.ownerId === uid || membership?.role === 'PRIMARY_ADMIN' || membership?.role === 'ADMIN']).catch(() => undefined);
            user.companyId = company.id;
            user.companyName = company.name;
            user.isCompanyAdmin = company.ownerId === uid || membership?.role === 'PRIMARY_ADMIN' || membership?.role === 'ADMIN';
        }
        const companyEligible = Boolean(company && (company.ownerId === uid ||
            membership?.role === 'PRIMARY_ADMIN' ||
            membership?.role === 'ADMIN' ||
            membership?.permissions?.marketplace === true ||
            (!membership && user.companyId === company.id && user.isCompanyAdmin)));
        const companyVerified = Boolean(company && (company.verificationStatus === company_entity_1.CompanyStatus.VERIFIED || company.isVerified));
        return { user, company, companyEligible, companyVerified };
    }
    async membership(uid, companyId) {
        const rows = await this.dataSource.query(`SELECT role,permissions,status FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND status='ACTIVE' LIMIT 1`, [companyId, uid]).catch(() => []);
        return rows[0] || null;
    }
};
exports.ClassifiedsIdentityService = ClassifiedsIdentityService;
exports.ClassifiedsIdentityService = ClassifiedsIdentityService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(classified_user_preference_entity_1.ClassifiedUserPreference)),
    __param(1, (0, typeorm_1.InjectRepository)(company_classified_profile_entity_1.CompanyClassifiedProfile)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], ClassifiedsIdentityService);
function cleanSegments(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.map((item) => String(item || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 20);
}
function cleanChannels(value, fallback) {
    if (!Array.isArray(value))
        return fallback;
    const channels = [...new Set(value.map((item) => String(item || '').toUpperCase()).filter((item) => CHANNELS.includes(item)))];
    return channels.length ? channels : fallback;
}
function cleanNullable(value, max) {
    const text = String(value ?? '').trim().slice(0, max);
    return text || null;
}
//# sourceMappingURL=classifieds-identity.service.js.map