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
exports.PaymentCheckoutStatusController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const payment_checkout_status_service_1 = require("./payment-checkout-status.service");
let PaymentCheckoutStatusController = class PaymentCheckoutStatusController {
    statusService;
    constructor(statusService) {
        this.statusService = statusService;
    }
    status(req, paymentId) {
        return this.statusService.getForUser(req.user.uid, paymentId);
    }
};
exports.PaymentCheckoutStatusController = PaymentCheckoutStatusController;
__decorate([
    (0, common_1.Get)(':paymentId/status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('paymentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentCheckoutStatusController.prototype, "status", null);
exports.PaymentCheckoutStatusController = PaymentCheckoutStatusController = __decorate([
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [payment_checkout_status_service_1.PaymentCheckoutStatusService])
], PaymentCheckoutStatusController);
//# sourceMappingURL=payment-checkout-status.controller.js.map