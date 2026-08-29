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
exports.WhatsAppPhoneVerificationController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const whatsapp_phone_verification_service_1 = require("./whatsapp-phone-verification.service");
let WhatsAppPhoneVerificationController = class WhatsAppPhoneVerificationController {
    verification;
    constructor(verification) {
        this.verification = verification;
    }
    status(req) {
        return this.verification.status(req.user.uid);
    }
    requestOtp(req, body) {
        return this.verification.request(req.user.uid, String(body?.phone || ''));
    }
    verifyOtp(req, body) {
        return this.verification.verify(req.user.uid, String(body?.phone || ''), String(body?.code || ''));
    }
};
exports.WhatsAppPhoneVerificationController = WhatsAppPhoneVerificationController;
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WhatsAppPhoneVerificationController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('request-otp'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppPhoneVerificationController.prototype, "requestOtp", null);
__decorate([
    (0, common_1.Post)('verify-otp'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppPhoneVerificationController.prototype, "verifyOtp", null);
exports.WhatsAppPhoneVerificationController = WhatsAppPhoneVerificationController = __decorate([
    (0, common_1.Controller)('whatsapp/phone'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [whatsapp_phone_verification_service_1.WhatsAppPhoneVerificationService])
], WhatsAppPhoneVerificationController);
//# sourceMappingURL=whatsapp-phone-verification.controller.js.map