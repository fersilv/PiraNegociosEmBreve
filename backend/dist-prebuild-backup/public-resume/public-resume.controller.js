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
exports.AdminPublicResumeController = exports.PublicResumeAccountController = exports.PublicResumeController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const admin_guard_1 = require("../admin/admin.guard");
const public_resume_service_1 = require("./public-resume.service");
let PublicResumeController = class PublicResumeController {
    publicResume;
    constructor(publicResume) {
        this.publicResume = publicResume;
    }
    createSession(req, body) {
        return this.publicResume.createSession(body || {}, {
            userAgent: String(req.headers?.['user-agent'] || ''),
            referrer: String(req.headers?.referer || req.headers?.referrer || ''),
        });
    }
    catalog() {
        return this.publicResume.catalog();
    }
    getSession(sessionId, token) {
        return this.publicResume.getSession(sessionId, token);
    }
    event(sessionId, token, body) {
        return this.publicResume.track(sessionId, token, body?.type, body?.metadata);
    }
    checkout(sessionId, token, body) {
        return this.publicResume.createCheckout(sessionId, token, body || {});
    }
    order(sessionId, orderId, token) {
        return this.publicResume.getOrder(sessionId, token, orderId);
    }
    unlockWatermark(sessionId, orderId, token) {
        return this.publicResume.unlockWatermark(sessionId, token, orderId);
    }
    review(sessionId, token, body) {
        return this.publicResume.reviewWithAi(sessionId, token, String(body?.orderId || ''), body?.profile || {});
    }
    improve(sessionId, token, body) {
        return this.publicResume.improveWithAi(sessionId, token, String(body?.orderId || ''), body?.profile || {});
    }
};
exports.PublicResumeController = PublicResumeController;
__decorate([
    (0, common_1.Post)('session'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "createSession", null);
__decorate([
    (0, common_1.Get)('catalog'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "catalog", null);
__decorate([
    (0, common_1.Get)(':sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Headers)('x-public-resume-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "getSession", null);
__decorate([
    (0, common_1.Post)(':sessionId/events'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Headers)('x-public-resume-token')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "event", null);
__decorate([
    (0, common_1.Post)(':sessionId/checkout'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Headers)('x-public-resume-token')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "checkout", null);
__decorate([
    (0, common_1.Get)(':sessionId/orders/:orderId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Headers)('x-public-resume-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "order", null);
__decorate([
    (0, common_1.Post)(':sessionId/orders/:orderId/unlock-watermark'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Headers)('x-public-resume-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "unlockWatermark", null);
__decorate([
    (0, common_1.Post)(':sessionId/ai/review'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Headers)('x-public-resume-token')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "review", null);
__decorate([
    (0, common_1.Post)(':sessionId/ai/improve'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Headers)('x-public-resume-token')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PublicResumeController.prototype, "improve", null);
exports.PublicResumeController = PublicResumeController = __decorate([
    (0, common_1.Controller)('public-resume'),
    __metadata("design:paramtypes", [public_resume_service_1.PublicResumeService])
], PublicResumeController);
let PublicResumeAccountController = class PublicResumeAccountController {
    publicResume;
    constructor(publicResume) {
        this.publicResume = publicResume;
    }
    link(req, body) {
        return this.publicResume.linkAccount(String(body?.sessionId || ''), String(body?.token || ''), req.user.uid);
    }
};
exports.PublicResumeAccountController = PublicResumeAccountController;
__decorate([
    (0, common_1.Post)('link'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PublicResumeAccountController.prototype, "link", null);
exports.PublicResumeAccountController = PublicResumeAccountController = __decorate([
    (0, common_1.Controller)('public-resume-account'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [public_resume_service_1.PublicResumeService])
], PublicResumeAccountController);
let AdminPublicResumeController = class AdminPublicResumeController {
    publicResume;
    constructor(publicResume) {
        this.publicResume = publicResume;
    }
    summary(days) {
        return this.publicResume.adminSummary(Number(days || 30));
    }
};
exports.AdminPublicResumeController = AdminPublicResumeController;
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPublicResumeController.prototype, "summary", null);
exports.AdminPublicResumeController = AdminPublicResumeController = __decorate([
    (0, common_1.Controller)('admin/public-resume'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [public_resume_service_1.PublicResumeService])
], AdminPublicResumeController);
//# sourceMappingURL=public-resume.controller.js.map