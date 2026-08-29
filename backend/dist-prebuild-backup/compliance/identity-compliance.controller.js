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
exports.IdentityComplianceAdminController = exports.IdentityComplianceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const company_context_repair_service_1 = require("./company-context-repair.service");
const identity_compliance_service_1 = require("./identity-compliance.service");
let IdentityComplianceController = class IdentityComplianceController {
    compliance;
    companyContext;
    constructor(compliance, companyContext) {
        this.compliance = compliance;
        this.companyContext = companyContext;
    }
    async me(req) {
        const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
        await this.companyContext.repair(userId);
        return this.compliance.myStatus(userId);
    }
    async profile(req, body) {
        const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
        await this.companyContext.repair(userId);
        return this.compliance.saveProfile(userId, body || {});
    }
    async partners(req, body) {
        const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
        await this.companyContext.repair(userId);
        return this.compliance.replacePartners(userId, body?.partners);
    }
    async upload(req, kind, file, body) {
        const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
        await this.companyContext.repair(userId);
        return this.compliance.uploadDocument(userId, kind, file, body || {});
    }
    async submit(req, body) {
        const userId = await this.compliance.resolveUserId(req.user.uid, req.user.email);
        await this.companyContext.repair(userId);
        return this.compliance.submit(userId, body || {});
    }
};
exports.IdentityComplianceController = IdentityComplianceController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IdentityComplianceController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('me/profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IdentityComplianceController.prototype, "profile", null);
__decorate([
    (0, common_1.Patch)('me/company-partners'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IdentityComplianceController.prototype, "partners", null);
__decorate([
    (0, common_1.Post)('me/documents/:kind'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('kind')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object]),
    __metadata("design:returntype", Promise)
], IdentityComplianceController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('me/submit'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IdentityComplianceController.prototype, "submit", null);
exports.IdentityComplianceController = IdentityComplianceController = __decorate([
    (0, common_1.Controller)('compliance'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [identity_compliance_service_1.IdentityComplianceService,
        company_context_repair_service_1.CompanyContextRepairService])
], IdentityComplianceController);
let IdentityComplianceAdminController = class IdentityComplianceAdminController {
    compliance;
    constructor(compliance) {
        this.compliance = compliance;
    }
    list(status) {
        return this.compliance.adminList(status);
    }
    detail(id) {
        return this.compliance.adminDetail(id);
    }
    async document(req, documentId, res) {
        const file = await this.compliance.readDocument(req.user.uid, documentId, req.ip || req.socket?.remoteAddress || '');
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${safeFileName(file.originalName)}"`);
        res.setHeader('Cache-Control', 'no-store, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(file.buffer);
    }
    review(req, id, body) {
        return this.compliance.adminReview(req.user.uid, id, body || {});
    }
};
exports.IdentityComplianceAdminController = IdentityComplianceAdminController;
__decorate([
    (0, common_1.Get)('verifications'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IdentityComplianceAdminController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('verifications/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IdentityComplianceAdminController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)('documents/:documentId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('documentId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], IdentityComplianceAdminController.prototype, "document", null);
__decorate([
    (0, common_1.Post)('verifications/:id/review'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], IdentityComplianceAdminController.prototype, "review", null);
exports.IdentityComplianceAdminController = IdentityComplianceAdminController = __decorate([
    (0, common_1.Controller)('admin/compliance'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [identity_compliance_service_1.IdentityComplianceService])
], IdentityComplianceAdminController);
function safeFileName(value) {
    return String(value || 'documento').replace(/[\r\n"\\/]/g, '_').slice(0, 180);
}
//# sourceMappingURL=identity-compliance.controller.js.map