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
exports.ClassifiedsSalesController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const classifieds_marketplace_payments_service_1 = require("./classifieds-marketplace-payments.service");
const classifieds_receipt_preferences_service_1 = require("./classifieds-receipt-preferences.service");
const classifieds_sales_service_1 = require("./classifieds-sales.service");
let ClassifiedsSalesController = class ClassifiedsSalesController {
    sales;
    marketplacePayments;
    receiptPreferences;
    constructor(sales, marketplacePayments, receiptPreferences) {
        this.sales = sales;
        this.marketplacePayments = marketplacePayments;
        this.receiptPreferences = receiptPreferences;
    }
    commerceStatus(req) {
        return this.sales.status(req.user.uid);
    }
    listingCommerce(req, listingId) {
        return this.sales.getListingCommerce(req.user.uid, listingId);
    }
    configureListing(req, listingId, body) {
        return this.sales.configureListing(req.user.uid, listingId, body || {});
    }
    inventory(req) {
        return this.sales.inventory(req.user.uid);
    }
    updateInventory(req, listingId, body) {
        return this.sales.updateInventory(req.user.uid, listingId, body || {});
    }
    dashboard(req) {
        return this.sales.dashboard(req.user.uid);
    }
    orders(req) {
        return this.sales.orders(req.user.uid);
    }
    updateOrderStatus(req, orderId, body) {
        return this.sales.updateOrderStatus(req.user.uid, orderId, body?.status);
    }
    appointments(req) {
        return this.sales.appointments(req.user.uid);
    }
    paymentConnections(req) {
        return this.marketplacePayments.connections(req.user.uid);
    }
    receiptSettings(req) {
        return this.receiptPreferences.get(req.user.uid);
    }
    updateReceiptSettings(req, body) {
        return this.receiptPreferences.update(req.user.uid, body || {});
    }
    startMercadoPago(req) {
        return this.marketplacePayments.startMercadoPago(req.user.uid);
    }
    completeMercadoPago(req, body) {
        return this.marketplacePayments.completeMercadoPago(req.user.uid, body?.state, body?.code);
    }
    disconnectMercadoPago(req) {
        return this.marketplacePayments.disconnectMercadoPago(req.user.uid);
    }
};
exports.ClassifiedsSalesController = ClassifiedsSalesController;
__decorate([
    (0, common_1.Get)('me/commerce/status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "commerceStatus", null);
__decorate([
    (0, common_1.Get)('me/commerce/listings/:listingId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "listingCommerce", null);
__decorate([
    (0, common_1.Patch)('me/commerce/listings/:listingId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('listingId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "configureListing", null);
__decorate([
    (0, common_1.Get)('me/inventory'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "inventory", null);
__decorate([
    (0, common_1.Patch)('me/inventory/:listingId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('listingId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "updateInventory", null);
__decorate([
    (0, common_1.Get)('me/sales/dashboard'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('me/sales/orders'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "orders", null);
__decorate([
    (0, common_1.Patch)('me/sales/orders/:orderId/status'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "updateOrderStatus", null);
__decorate([
    (0, common_1.Get)('me/services/appointments'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "appointments", null);
__decorate([
    (0, common_1.Get)('me/payments/connections'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "paymentConnections", null);
__decorate([
    (0, common_1.Get)('me/payments/receipt-preferences'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "receiptSettings", null);
__decorate([
    (0, common_1.Patch)('me/payments/receipt-preferences'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "updateReceiptSettings", null);
__decorate([
    (0, common_1.Post)('me/payments/mercado-pago/oauth/start'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "startMercadoPago", null);
__decorate([
    (0, common_1.Post)('me/payments/mercado-pago/oauth/complete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "completeMercadoPago", null);
__decorate([
    (0, common_1.Post)('me/payments/mercado-pago/disconnect'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsSalesController.prototype, "disconnectMercadoPago", null);
exports.ClassifiedsSalesController = ClassifiedsSalesController = __decorate([
    (0, common_1.Controller)('classifieds'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [classifieds_sales_service_1.ClassifiedsSalesService,
        classifieds_marketplace_payments_service_1.ClassifiedsMarketplacePaymentsService,
        classifieds_receipt_preferences_service_1.ClassifiedsReceiptPreferencesService])
], ClassifiedsSalesController);
//# sourceMappingURL=classifieds-sales.controller.js.map