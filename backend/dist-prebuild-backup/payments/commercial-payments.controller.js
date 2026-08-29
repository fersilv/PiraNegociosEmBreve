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
exports.AdminCommercialPaymentsController = exports.CommercialPaymentsController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const commercial_payments_service_1 = require("./commercial-payments.service");
let CommercialPaymentsController = class CommercialPaymentsController {
    commercial;
    constructor(commercial) {
        this.commercial = commercial;
    }
    catalog() {
        return this.commercial.listProducts(false);
    }
    checkout(req, body) {
        return this.commercial.createCheckout(req.user.uid, String(body?.productCode || '').trim(), body?.purchaseMode, body?.payer || {});
    }
};
exports.CommercialPaymentsController = CommercialPaymentsController;
__decorate([
    (0, common_1.Get)('catalog'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommercialPaymentsController.prototype, "catalog", null);
__decorate([
    (0, common_1.Post)('checkout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], CommercialPaymentsController.prototype, "checkout", null);
exports.CommercialPaymentsController = CommercialPaymentsController = __decorate([
    (0, common_1.Controller)('payments/commercial'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [commercial_payments_service_1.CommercialPaymentsService])
], CommercialPaymentsController);
let AdminCommercialPaymentsController = class AdminCommercialPaymentsController {
    commercial;
    constructor(commercial) {
        this.commercial = commercial;
    }
    list() {
        return this.commercial.listProducts(true);
    }
    update(code, body) {
        return this.commercial.updateProduct(code, body || {});
    }
};
exports.AdminCommercialPaymentsController = AdminCommercialPaymentsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCommercialPaymentsController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':code'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminCommercialPaymentsController.prototype, "update", null);
exports.AdminCommercialPaymentsController = AdminCommercialPaymentsController = __decorate([
    (0, common_1.Controller)('admin/payments/commercial-products'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [commercial_payments_service_1.CommercialPaymentsService])
], AdminCommercialPaymentsController);
//# sourceMappingURL=commercial-payments.controller.js.map