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
exports.ClassifiedsAuctionManagementController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const classifieds_auction_management_service_1 = require("./classifieds-auction-management.service");
let ClassifiedsAuctionManagementController = class ClassifiedsAuctionManagementController {
    management;
    constructor(management) {
        this.management = management;
    }
    list(req) {
        return this.management.list(req.user.uid);
    }
    detail(req, auctionId) {
        return this.management.detail(req.user.uid, auctionId);
    }
    updateSettlement(req, auctionId, body) {
        return this.management.updateSettlement(req.user.uid, auctionId, body?.status);
    }
};
exports.ClassifiedsAuctionManagementController = ClassifiedsAuctionManagementController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionManagementController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':auctionId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionManagementController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':auctionId/settlement'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('auctionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsAuctionManagementController.prototype, "updateSettlement", null);
exports.ClassifiedsAuctionManagementController = ClassifiedsAuctionManagementController = __decorate([
    (0, common_1.Controller)('classifieds/me/auction-management'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [classifieds_auction_management_service_1.ClassifiedsAuctionManagementService])
], ClassifiedsAuctionManagementController);
//# sourceMappingURL=classifieds-auction-management.controller.js.map