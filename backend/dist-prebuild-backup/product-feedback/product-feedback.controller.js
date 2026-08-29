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
exports.PublicFaqController = exports.AdminProductFeedbackController = exports.ProductFeedbackController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const ai_service_1 = require("../ai/ai.service");
const product_feedback_service_1 = require("./product-feedback.service");
const support_assistant_service_1 = require("./support-assistant.service");
let ProductFeedbackController = class ProductFeedbackController {
    feedback;
    ai;
    supportAssistant;
    constructor(feedback, ai, supportAssistant) {
        this.feedback = feedback;
        this.ai = ai;
        this.supportAssistant = supportAssistant;
    }
    async status() {
        const ai = await this.ai.getSupportStatus();
        return { aiEnabled: ai.enabled, assistantName: ai.assistantName };
    }
    submit(req, body) {
        return this.feedback.submit(req.user.uid, body);
    }
    expectations(req) {
        return this.feedback.mineAwaitingExpectation(req.user.uid);
    }
    expectation(req, id, body) {
        return this.feedback.respondExpectation(req.user.uid, id, body);
    }
    mySupport(req) {
        return this.feedback.mySupport(req.user.uid);
    }
    supportChat(req, body) {
        return this.supportAssistant.chat(req.user.uid, body);
    }
    escalate(req, id) {
        return this.feedback.escalateSupport(req.user.uid, id);
    }
};
exports.ProductFeedbackController = ProductFeedbackController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductFeedbackController.prototype, "status", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProductFeedbackController.prototype, "submit", null);
__decorate([
    (0, common_1.Get)('expectations'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductFeedbackController.prototype, "expectations", null);
__decorate([
    (0, common_1.Post)(':id/expectation'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ProductFeedbackController.prototype, "expectation", null);
__decorate([
    (0, common_1.Get)('support/mine'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductFeedbackController.prototype, "mySupport", null);
__decorate([
    (0, common_1.Post)('support/chat'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProductFeedbackController.prototype, "supportChat", null);
__decorate([
    (0, common_1.Post)('support/:id/escalate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductFeedbackController.prototype, "escalate", null);
exports.ProductFeedbackController = ProductFeedbackController = __decorate([
    (0, common_1.Controller)('product-feedback'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [product_feedback_service_1.ProductFeedbackService,
        ai_service_1.AiService,
        support_assistant_service_1.SupportAssistantService])
], ProductFeedbackController);
let AdminProductFeedbackController = class AdminProductFeedbackController {
    feedback;
    constructor(feedback) {
        this.feedback = feedback;
    }
    async admin(req) {
        return this.feedback.assertAdmin(req.user.uid);
    }
    async overview(req) {
        await this.admin(req);
        return this.feedback.overview();
    }
    async analyze(req, body) {
        await this.admin(req);
        return this.feedback.analyze(body?.force === true);
    }
    async generateFaqs(req) {
        await this.admin(req);
        return this.feedback.generateFaqs(true);
    }
    async updateFaq(req, id, body) {
        await this.admin(req);
        return this.feedback.updateFaq(id, body);
    }
    async update(req, id, body) {
        await this.admin(req);
        return this.feedback.updateFeedback(id, body);
    }
    async screenshot(req, source, id) {
        await this.admin(req);
        return this.feedback.screenshotForAdmin(source, id);
    }
    async reply(req, id, body) {
        await this.admin(req);
        return this.feedback.adminReply(id, body);
    }
};
exports.AdminProductFeedbackController = AdminProductFeedbackController;
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminProductFeedbackController.prototype, "overview", null);
__decorate([
    (0, common_1.Post)('analyze'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminProductFeedbackController.prototype, "analyze", null);
__decorate([
    (0, common_1.Post)('faqs/generate'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminProductFeedbackController.prototype, "generateFaqs", null);
__decorate([
    (0, common_1.Patch)('faqs/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminProductFeedbackController.prototype, "updateFaq", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminProductFeedbackController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':source/:id/screenshot'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('source')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AdminProductFeedbackController.prototype, "screenshot", null);
__decorate([
    (0, common_1.Post)('support/:id/reply'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminProductFeedbackController.prototype, "reply", null);
exports.AdminProductFeedbackController = AdminProductFeedbackController = __decorate([
    (0, common_1.Controller)('admin/product-feedback'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [product_feedback_service_1.ProductFeedbackService])
], AdminProductFeedbackController);
let PublicFaqController = class PublicFaqController {
    feedback;
    constructor(feedback) {
        this.feedback = feedback;
    }
    list() {
        return this.feedback.publicFaqs();
    }
    article(slug) {
        return this.feedback.publicFaqs(slug);
    }
};
exports.PublicFaqController = PublicFaqController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicFaqController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicFaqController.prototype, "article", null);
exports.PublicFaqController = PublicFaqController = __decorate([
    (0, common_1.Controller)('help/faqs'),
    __metadata("design:paramtypes", [product_feedback_service_1.ProductFeedbackService])
], PublicFaqController);
//# sourceMappingURL=product-feedback.controller.js.map