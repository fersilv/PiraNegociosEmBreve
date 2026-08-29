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
exports.ClassifiedsCatalogAdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const classifieds_catalog_admin_service_1 = require("./classifieds-catalog-admin.service");
let ClassifiedsCatalogAdminController = class ClassifiedsCatalogAdminController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    summary() {
        return this.catalog.summary();
    }
    listings(query) {
        return this.catalog.listings(query || {});
    }
    listing(id) {
        return this.catalog.listing(id);
    }
    updateListing(req, id, body) {
        return this.catalog.updateListing(id, req.user.uid, body || {});
    }
    archiveListing(req, id) {
        return this.catalog.archiveListing(id, req.user.uid);
    }
    restoreListing(id) {
        return this.catalog.restoreListing(id);
    }
    deleteListing(req, id) {
        return this.catalog.deleteListing(id, req.user.uid);
    }
    auctions(query) {
        return this.catalog.auctions(query || {});
    }
    archiveAuction(req, id) {
        return this.catalog.archiveAuction(id, req.user.uid);
    }
    restoreAuction(id) {
        return this.catalog.restoreAuction(id);
    }
    cancelAuction(id) {
        return this.catalog.cancelAuction(id);
    }
    deleteAuction(req, id) {
        return this.catalog.deleteAuction(id, req.user.uid);
    }
};
exports.ClassifiedsCatalogAdminController = ClassifiedsCatalogAdminController;
__decorate([
    (0, common_1.Get)('summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('listings'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "listings", null);
__decorate([
    (0, common_1.Get)('listings/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "listing", null);
__decorate([
    (0, common_1.Patch)('listings/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "updateListing", null);
__decorate([
    (0, common_1.Post)('listings/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "archiveListing", null);
__decorate([
    (0, common_1.Post)('listings/:id/restore'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "restoreListing", null);
__decorate([
    (0, common_1.Delete)('listings/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "deleteListing", null);
__decorate([
    (0, common_1.Get)('auctions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "auctions", null);
__decorate([
    (0, common_1.Post)('auctions/:id/archive'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "archiveAuction", null);
__decorate([
    (0, common_1.Post)('auctions/:id/restore'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "restoreAuction", null);
__decorate([
    (0, common_1.Post)('auctions/:id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "cancelAuction", null);
__decorate([
    (0, common_1.Delete)('auctions/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClassifiedsCatalogAdminController.prototype, "deleteAuction", null);
exports.ClassifiedsCatalogAdminController = ClassifiedsCatalogAdminController = __decorate([
    (0, common_1.Controller)('admin/classifieds-catalog'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [classifieds_catalog_admin_service_1.ClassifiedsCatalogAdminService])
], ClassifiedsCatalogAdminController);
//# sourceMappingURL=classifieds-catalog-admin.controller.js.map