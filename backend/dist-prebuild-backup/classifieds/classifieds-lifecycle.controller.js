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
exports.ClassifiedsLifecycleController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const classifieds_lifecycle_service_1 = require("./classifieds-lifecycle.service");
let ClassifiedsLifecycleController = class ClassifiedsLifecycleController {
    lifecycle;
    constructor(lifecycle) {
        this.lifecycle = lifecycle;
    }
    archiveListing(req, id) {
        return this.lifecycle.archiveListing(req.user.uid, id);
    }
    restoreListing(req, id) {
        return this.lifecycle.restoreListing(req.user.uid, id);
    }
    republishListing(req, id) {
        return this.lifecycle.republishListing(req.user.uid, id);
    }
    markSold(req, id) {
        return this.lifecycle.markSold(req.user.uid, id);
    }
    setUniqueItem(req, id, body) {
        return this.lifecycle.setUniqueItem(req.user.uid, id, body?.unique);
    }
    deleteListing(req, id) {
        return this.lifecycle.deleteListing(req.user.uid, id);
    }
    archiveAuction(req, id) {
        return this.lifecycle.archiveAuction(req.user.uid, id);
    }
    restoreAuction(req, id) {
        return this.lifecycle.restoreAuction(req.user.uid, id);
    }
    deleteAuction(req, id) {
        return this.lifecycle.deleteAuction(req.user.uid, id);
    }
};
exports.ClassifiedsLifecycleController = ClassifiedsLifecycleController;
__decorate([
    (0, common_1.Post)('listings/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "archiveListing", null);
__decorate([
    (0, common_1.Post)('listings/:id/restore'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "restoreListing", null);
__decorate([
    (0, common_1.Post)('listings/:id/republish'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "republishListing", null);
__decorate([
    (0, common_1.Post)('listings/:id/sold'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "markSold", null);
__decorate([
    (0, common_1.Patch)('listings/:id/unique'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "setUniqueItem", null);
__decorate([
    (0, common_1.Delete)('listings/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "deleteListing", null);
__decorate([
    (0, common_1.Post)('auctions/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "archiveAuction", null);
__decorate([
    (0, common_1.Post)('auctions/:id/restore'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "restoreAuction", null);
__decorate([
    (0, common_1.Delete)('auctions/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsLifecycleController.prototype, "deleteAuction", null);
exports.ClassifiedsLifecycleController = ClassifiedsLifecycleController = __decorate([
    (0, common_1.Controller)('classifieds/me/lifecycle'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard),
    __metadata("design:paramtypes", [classifieds_lifecycle_service_1.ClassifiedsLifecycleService])
], ClassifiedsLifecycleController);
//# sourceMappingURL=classifieds-lifecycle.controller.js.map