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
exports.ClassifiedsAuctionExtrasController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const classifieds_auction_engagement_service_1 = require("./classifieds-auction-engagement.service");
const classifieds_auction_payment_policy_service_1 = require("./classifieds-auction-payment-policy.service");
let ClassifiedsAuctionExtrasController = class ClassifiedsAuctionExtrasController {
    engagement;
    paymentPolicy;
    constructor(engagement, paymentPolicy) {
        this.engagement = engagement;
        this.paymentPolicy = paymentPolicy;
    }
    paymentDefaults(req) {
        return this.paymentPolicy.defaults(req.user.uid);
    }
    reminderStatus(req, auctionId) {
        return this.engagement.reminderStatus(req.user.uid, auctionId);
    }
    reminder(req, auctionId, body) {
        return this.engagement.setReminder(req.user.uid, auctionId, body?.enabled);
    }
    presence(req, auctionId) {
        return this.engagement.presence(req.user.uid, auctionId);
    }
    buyerSettlement(req, auctionId) {
        return this.paymentPolicy.buyerConfig(req.user.uid, auctionId);
    }
    checkout(req, auctionId, body) {
        return this.paymentPolicy.createPayment(req.user.uid, auctionId, body || {});
    }
    sellerSettlement(req, auctionId) {
        return this.paymentPolicy.sellerConfig(req.user.uid, auctionId);
    }
    configureSeller(req, auctionId, body) {
        return this.paymentPolicy.configureSeller(req.user.uid, auctionId, body || {});
    }
};
exports.ClassifiedsAuctionExtrasController = ClassifiedsAuctionExtrasController;
__decorate([
    (0, common_1.Get)('payment-defaults'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionExtrasController.prototype, "paymentDefaults", null);
__decorate([
    (0, common_1.Get)(':auctionId/reminder'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionExtrasController.prototype, "reminderStatus", null);
__decorate([
    (0, common_1.Post)(':auctionId/reminder'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionExtrasController.prototype, "reminder", null);
__decorate([
    (0, common_1.Post)(':auctionId/presence'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionExtrasController.prototype, "presence", null);
__decorate([
    (0, common_1.Get)(':auctionId/settlement'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionExtrasController.prototype, "buyerSettlement", null);
__decorate([
    (0, common_1.Post)(':auctionId/settlement/checkout'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionExtrasController.prototype, "checkout", null);
__decorate([
    (0, common_1.Get)(':auctionId/seller-settlement'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionExtrasController.prototype, "sellerSettlement", null);
__decorate([
    (0, common_1.Patch)(':auctionId/seller-settlement'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionExtrasController.prototype, "configureSeller", null);
exports.ClassifiedsAuctionExtrasController = ClassifiedsAuctionExtrasController = __decorate([
    (0, common_1.Controller)('classifieds/auctions'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [classifieds_auction_engagement_service_1.ClassifiedsAuctionEngagementService,
        classifieds_auction_payment_policy_service_1.ClassifiedsAuctionPaymentPolicyService])
], ClassifiedsAuctionExtrasController);
//# sourceMappingURL=classifieds-auction-extras.controller.js.map