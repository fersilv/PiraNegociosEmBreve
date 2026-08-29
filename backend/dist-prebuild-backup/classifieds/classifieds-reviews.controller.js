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
exports.ClassifiedsReviewsAdminController = exports.ClassifiedsReviewsPublicController = exports.ClassifiedsReviewsController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const classifieds_reviews_service_1 = require("./classifieds-reviews.service");
let ClassifiedsReviewsController = class ClassifiedsReviewsController {
    reviews;
    constructor(reviews) {
        this.reviews = reviews;
    }
    eligible(req) {
        return this.reviews.eligible(req.user.uid);
    }
    mine(req) {
        return this.reviews.mine(req.user.uid);
    }
    submit(req, orderId, body) {
        return this.reviews.submit(req.user.uid, orderId, body || {});
    }
};
exports.ClassifiedsReviewsController = ClassifiedsReviewsController;
__decorate([
    (0, common_1.Get)('eligible'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsReviewsController.prototype, "eligible", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsReviewsController.prototype, "mine", null);
__decorate([
    (0, common_1.Post)('orders/:orderId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsReviewsController.prototype, "submit", null);
exports.ClassifiedsReviewsController = ClassifiedsReviewsController = __decorate([
    (0, common_1.Controller)('classifieds/me/reviews'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [classifieds_reviews_service_1.ClassifiedsReviewsService])
], ClassifiedsReviewsController);
let ClassifiedsReviewsPublicController = class ClassifiedsReviewsPublicController {
    reviews;
    constructor(reviews) {
        this.reviews = reviews;
    }
    listing(listingId) {
        return this.reviews.publicListing(listingId);
    }
    company(companyId) {
        return this.reviews.publicCompany(companyId);
    }
};
exports.ClassifiedsReviewsPublicController = ClassifiedsReviewsPublicController;
__decorate([
    (0, common_1.Get)('listings/:listingId'),
    __param(0, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassifiedsReviewsPublicController.prototype, "listing", null);
__decorate([
    (0, common_1.Get)('companies/:companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassifiedsReviewsPublicController.prototype, "company", null);
exports.ClassifiedsReviewsPublicController = ClassifiedsReviewsPublicController = __decorate([
    (0, common_1.Controller)('classifieds/public/reviews'),
    __metadata("design:paramtypes", [classifieds_reviews_service_1.ClassifiedsReviewsService])
], ClassifiedsReviewsPublicController);
let ClassifiedsReviewsAdminController = class ClassifiedsReviewsAdminController {
    reviews;
    constructor(reviews) {
        this.reviews = reviews;
    }
    pending() {
        return this.reviews.pendingModeration();
    }
    moderate(reviewId, body) {
        return this.reviews.moderateManually(reviewId, body?.decision, body?.reason);
    }
};
exports.ClassifiedsReviewsAdminController = ClassifiedsReviewsAdminController;
__decorate([
    (0, common_1.Get)('pending'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClassifiedsReviewsAdminController.prototype, "pending", null);
__decorate([
    (0, common_1.Patch)(':reviewId'),
    __param(0, (0, common_1.Param)('reviewId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsReviewsAdminController.prototype, "moderate", null);
exports.ClassifiedsReviewsAdminController = ClassifiedsReviewsAdminController = __decorate([
    (0, common_1.Controller)('admin/classifieds-reviews'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [classifieds_reviews_service_1.ClassifiedsReviewsService])
], ClassifiedsReviewsAdminController);
//# sourceMappingURL=classifieds-reviews.controller.js.map