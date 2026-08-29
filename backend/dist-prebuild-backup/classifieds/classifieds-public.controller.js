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
exports.ClassifiedsPublicController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const classifieds_category_taxonomy_service_1 = require("./classifieds-category-taxonomy.service");
const classifieds_commerce_service_1 = require("./classifieds-commerce.service");
const classifieds_service_1 = require("./classifieds.service");
const company_classified_profile_entity_1 = require("./entities/company-classified-profile.entity");
let ClassifiedsPublicController = class ClassifiedsPublicController {
    classifieds;
    taxonomy;
    commerce;
    companyProfiles;
    constructor(classifieds, taxonomy, commerce, companyProfiles) {
        this.classifieds = classifieds;
        this.taxonomy = taxonomy;
        this.commerce = commerce;
        this.companyProfiles = companyProfiles;
    }
    categories() {
        return this.taxonomy.categories();
    }
    search(query) {
        return this.classifieds.search(query);
    }
    async companyListings(companyId) {
        const [items, profile] = await Promise.all([
            this.classifieds.companyPageListings(companyId),
            this.companyProfiles.findOne({ where: { companyId, status: 'ACTIVE' } }),
        ]);
        return {
            items,
            pageSectionLabel: profile?.pageSectionLabel || null,
        };
    }
    async detail(slug) {
        const listing = await this.classifieds.getPublicBySlug(slug);
        await this.commerce.trackEvent(listing.id, 'VIEW');
        return listing;
    }
    async event(id, body) {
        const type = String(body?.type || '').toUpperCase();
        if (type === 'CONTACT_CLICK')
            await this.commerce.trackEvent(id, 'CONTACT_CLICK', null, null, { channel: String(body?.channel || '').slice(0, 40) });
        return { ok: true };
    }
};
exports.ClassifiedsPublicController = ClassifiedsPublicController;
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClassifiedsPublicController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('listings'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClassifiedsPublicController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('company/:companyId/listings'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClassifiedsPublicController.prototype, "companyListings", null);
__decorate([
    (0, common_1.Get)('listings/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClassifiedsPublicController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)('listings/:id/events'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClassifiedsPublicController.prototype, "event", null);
exports.ClassifiedsPublicController = ClassifiedsPublicController = __decorate([
    (0, common_1.Controller)('classifieds'),
    __param(3, (0, typeorm_1.InjectRepository)(company_classified_profile_entity_1.CompanyClassifiedProfile)),
    __metadata("design:paramtypes", [classifieds_service_1.ClassifiedsService,
        classifieds_category_taxonomy_service_1.ClassifiedsCategoryTaxonomyService,
        classifieds_commerce_service_1.ClassifiedsCommerceService,
        typeorm_2.Repository])
], ClassifiedsPublicController);
//# sourceMappingURL=classifieds-public.controller.js.map