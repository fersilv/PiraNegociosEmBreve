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
exports.CompanyVerificationAdminController = exports.CompanyVerificationPublicController = exports.CompanyVerificationController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const typeorm_1 = require("typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const cnpj_lookup_service_1 = require("./cnpj-lookup.service");
const company_verification_authorization_service_1 = require("./company-verification-authorization.service");
const COMPANY_PERMISSION_KEYS = ['companyProfile', 'recruitment', 'marketplace', 'finance', 'team'];
let CompanyVerificationController = class CompanyVerificationController {
    dataSource;
    cnpj;
    authorizations;
    constructor(dataSource, cnpj, authorizations) {
        this.dataSource = dataSource;
        this.cnpj = cnpj;
        this.authorizations = authorizations;
    }
    preview(cnpj) {
        return this.cnpj.lookup(cnpj);
    }
    async lookup(req, cnpj) {
        const companyId = await this.companyId(req.user.uid);
        await this.assertPermission(req.user.uid, companyId, 'companyProfile');
        const snapshot = await this.cnpj.lookup(cnpj);
        const applied = await this.cnpj.applyToCompany(companyId, snapshot);
        return { snapshot, changes: applied.changes };
    }
    async commercialProfile(req, body) {
        const companyId = await this.companyId(req.user.uid);
        await this.assertPermission(req.user.uid, companyId, 'companyProfile');
        const companies = await this.dataSource.query(`SELECT "legalAddress","legalCity","legalState" FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
        const company = companies[0];
        const same = body.commercialAddressSameAsLegal !== false;
        const name = String(body.name || '').trim().slice(0, 240);
        if (!name)
            throw new common_1.BadRequestException('Informe o nome comercial da empresa.');
        const address = same ? String(company?.legalAddress || '') : String(body.address || '').trim().slice(0, 500);
        const city = same ? String(company?.legalCity || '') : String(body.city || '').trim().slice(0, 120);
        const state = (same ? String(company?.legalState || '') : String(body.state || '')).trim().toUpperCase().slice(0, 2);
        if (!address || !city || state.length !== 2)
            throw new common_1.BadRequestException('Informe o endereço comercial completo.');
        const rows = await this.dataSource.query(`UPDATE companies SET name=$2,"commercialAddressSameAsLegal"=$3,address=$4,city=$5,state=$6,
       "cityState"=concat_ws(', ',NULLIF($5,''),NULLIF($6,'')),"updatedAt"=now()
       WHERE id=$1 RETURNING id,name,address,city,state,"cityState","commercialAddressSameAsLegal"`, [companyId, name, same, address, city, state]);
        return rows[0];
    }
    async team(req) {
        const companyId = await this.companyId(req.user.uid);
        await this.assertPermission(req.user.uid, companyId, 'team');
        return this.dataSource.query(`SELECT m.id,m."userId",m.role,m."isPartner",m.permissions,m.status,m."createdAt",m."updatedAt",
              COALESCE(u."socialName",u."displayName",u."fullName",u.email) AS name,u.email,u."whatsappPhoneE164",u.phone
       FROM company_memberships m JOIN users u ON u.id=m."userId"
       WHERE m."companyId"=$1 AND m.status='ACTIVE'
       ORDER BY CASE m.role WHEN 'PRIMARY_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,name ASC`, [companyId]).catch(() => []);
    }
    async teamPermissions(req, userId, body) {
        const companyId = await this.companyId(req.user.uid);
        const actor = await this.primaryAdmin(req.user.uid, companyId);
        if (actor.userId === userId)
            throw new common_1.BadRequestException('O administrador principal não pode remover os próprios poderes por esta tela.');
        const permissions = this.cleanPermissions(body.permissions);
        const role = String(body.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
        const rows = await this.dataSource.query(`UPDATE company_memberships SET role=$3,permissions=$4::jsonb,"updatedAt"=now()
       WHERE "companyId"=$1 AND "userId"=$2 AND role<>'PRIMARY_ADMIN' AND status='ACTIVE' RETURNING *`, [companyId, userId, role, JSON.stringify(permissions)]);
        if (!rows[0])
            throw new common_1.BadRequestException('Pessoa não encontrada na equipe ou vínculo não editável.');
        await this.dataSource.query(`UPDATE users SET "isCompanyAdmin"=$3 WHERE id=$2 AND "companyId"=$1`, [companyId, userId, role === 'ADMIN']).catch(() => undefined);
        return rows[0];
    }
    createAuthorization(req, body) {
        return this.authorizations.create(req.user.uid, body || {});
    }
    async myAuthorizations(req) {
        const companyId = await this.companyId(req.user.uid);
        await this.assertPermission(req.user.uid, companyId, 'companyProfile');
        return this.dataSource.query(`SELECT id,"partnerName","partnerEmail","partnerPhone","qsaQualification",status,"grantFullPowers",permissions,"submittedAt","reviewedAt","reviewReason","expiresAt","createdAt"
       FROM company_verification_authorizations WHERE "companyId"=$1 ORDER BY "createdAt" DESC LIMIT 50`, [companyId]).catch(() => []);
    }
    async companyId(uid) {
        const users = await this.dataSource.query(`SELECT "companyId" FROM users WHERE id=$1 LIMIT 1`, [uid]);
        const companyId = users[0]?.companyId;
        if (!companyId)
            throw new common_1.BadRequestException('Conta sem empresa vinculada.');
        return companyId;
    }
    async membership(uid, companyId) {
        const rows = await this.dataSource.query(`SELECT * FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 AND status='ACTIVE' LIMIT 1`, [companyId, uid]).catch(() => []);
        return rows[0] || null;
    }
    async primaryAdmin(uid, companyId) {
        const membership = await this.membership(uid, companyId);
        if (!membership || membership.role !== 'PRIMARY_ADMIN')
            throw new common_1.BadRequestException('Somente o administrador principal pode alterar permissões da equipe.');
        return membership;
    }
    async assertPermission(uid, companyId, permission) {
        const membership = await this.membership(uid, companyId);
        if (!membership)
            throw new common_1.BadRequestException('Seu vínculo com a empresa não está ativo.');
        if (membership.role === 'PRIMARY_ADMIN' || membership.permissions?.[permission] === true)
            return membership;
        throw new common_1.BadRequestException('Seu perfil não tem permissão para esta área da empresa.');
    }
    cleanPermissions(value) {
        const input = value && typeof value === 'object' ? value : {};
        return Object.fromEntries(COMPANY_PERMISSION_KEYS.map((key) => [key, input[key] === true]));
    }
};
exports.CompanyVerificationController = CompanyVerificationController;
__decorate([
    (0, common_1.Get)('cnpj-preview/:cnpj'),
    __param(0, (0, common_1.Param)('cnpj')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyVerificationController.prototype, "preview", null);
__decorate([
    (0, common_1.Get)('cnpj/:cnpj'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('cnpj')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompanyVerificationController.prototype, "lookup", null);
__decorate([
    (0, common_1.Patch)('commercial-profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CompanyVerificationController.prototype, "commercialProfile", null);
__decorate([
    (0, common_1.Get)('team'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompanyVerificationController.prototype, "team", null);
__decorate([
    (0, common_1.Patch)('team/:userId/permissions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CompanyVerificationController.prototype, "teamPermissions", null);
__decorate([
    (0, common_1.Post)('responsible-authorization'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CompanyVerificationController.prototype, "createAuthorization", null);
__decorate([
    (0, common_1.Get)('responsible-authorizations'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompanyVerificationController.prototype, "myAuthorizations", null);
exports.CompanyVerificationController = CompanyVerificationController = __decorate([
    (0, common_1.Controller)('compliance/company'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        cnpj_lookup_service_1.CnpjLookupService,
        company_verification_authorization_service_1.CompanyVerificationAuthorizationService])
], CompanyVerificationController);
let CompanyVerificationPublicController = class CompanyVerificationPublicController {
    authorizations;
    constructor(authorizations) {
        this.authorizations = authorizations;
    }
    info(token) {
        return this.authorizations.publicInfo(token);
    }
    selfie(token, file) {
        return this.authorizations.uploadSelfie(token, file);
    }
    accept(token, body) {
        return this.authorizations.accept(token, body || {});
    }
};
exports.CompanyVerificationPublicController = CompanyVerificationPublicController;
__decorate([
    (0, common_1.Get)(':token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyVerificationPublicController.prototype, "info", null);
__decorate([
    (0, common_1.Post)(':token/selfie'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } })),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CompanyVerificationPublicController.prototype, "selfie", null);
__decorate([
    (0, common_1.Post)(':token/accept'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CompanyVerificationPublicController.prototype, "accept", null);
exports.CompanyVerificationPublicController = CompanyVerificationPublicController = __decorate([
    (0, common_1.Controller)('company-verification'),
    __metadata("design:paramtypes", [company_verification_authorization_service_1.CompanyVerificationAuthorizationService])
], CompanyVerificationPublicController);
let CompanyVerificationAdminController = class CompanyVerificationAdminController {
    authorizations;
    constructor(authorizations) {
        this.authorizations = authorizations;
    }
    list(status) {
        return this.authorizations.adminList(status);
    }
    detail(id) {
        return this.authorizations.adminDetail(id);
    }
    async selfie(req, id, res) {
        const file = await this.authorizations.adminSelfie(id, req.user.uid, req.ip || req.socket?.remoteAddress || '');
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${String(file.originalName || 'selfie.jpg').replace(/[\r\n"\\/]/g, '_')}"`);
        res.setHeader('Cache-Control', 'no-store, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(file.buffer);
    }
    review(req, id, body) {
        return this.authorizations.adminReview(req.user.uid, id, body || {});
    }
};
exports.CompanyVerificationAdminController = CompanyVerificationAdminController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyVerificationAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyVerificationAdminController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)(':id/selfie'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CompanyVerificationAdminController.prototype, "selfie", null);
__decorate([
    (0, common_1.Post)(':id/review'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CompanyVerificationAdminController.prototype, "review", null);
exports.CompanyVerificationAdminController = CompanyVerificationAdminController = __decorate([
    (0, common_1.Controller)('admin/compliance/company-authorizations'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [company_verification_authorization_service_1.CompanyVerificationAuthorizationService])
], CompanyVerificationAdminController);
//# sourceMappingURL=company-verification.controller.js.map