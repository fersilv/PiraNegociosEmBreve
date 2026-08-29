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
exports.ClassifiedsCheckoutController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const classifieds_checkout_service_1 = require("./classifieds-checkout.service");
const classifieds_marketplace_terms_service_1 = require("./classifieds-marketplace-terms.service");
let ClassifiedsCheckoutController = class ClassifiedsCheckoutController {
    checkout;
    terms;
    constructor(checkout, terms) {
        this.checkout = checkout;
        this.terms = terms;
    }
    config(req, listingId) {
        return this.checkout.config(req.user.uid, listingId);
    }
    createPayment(req, listingId, body) {
        return this.checkout.createPayment(req.user.uid, listingId, body || {});
    }
    purchases(req) {
        return this.checkout.purchases(req.user.uid);
    }
    termsStatus(req) {
        return this.terms.status(req.user.uid);
    }
    acceptTerms(req, userAgent, body) {
        return this.terms.accept(req.user.uid, body?.scope, {
            surface: body?.surface || 'CLASSIFIEDS',
            userAgent: userAgent || '',
        });
    }
};
exports.ClassifiedsCheckoutController = ClassifiedsCheckoutController;
__decorate([
    (0, common_1.Get)('listings/:listingId/checkout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCheckoutController.prototype, "config", null);
__decorate([
    (0, common_1.Post)('listings/:listingId/checkout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('listingId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCheckoutController.prototype, "createPayment", null);
__decorate([
    (0, common_1.Get)('me/purchases'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCheckoutController.prototype, "purchases", null);
__decorate([
    (0, common_1.Get)('me/marketplace-terms'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCheckoutController.prototype, "termsStatus", null);
__decorate([
    (0, common_1.Post)('me/marketplace-terms/accept'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('user-agent')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCheckoutController.prototype, "acceptTerms", null);
exports.ClassifiedsCheckoutController = ClassifiedsCheckoutController = __decorate([
    (0, common_1.Controller)('classifieds'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [classifieds_checkout_service_1.ClassifiedsCheckoutService,
        classifieds_marketplace_terms_service_1.ClassifiedsMarketplaceTermsService])
], ClassifiedsCheckoutController);
//# sourceMappingURL=classifieds-checkout.controller.js.map