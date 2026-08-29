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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyClassifiedProfile = void 0;
const typeorm_1 = require("typeorm");
let CompanyClassifiedProfile = class CompanyClassifiedProfile {
    companyId;
    status;
    termsVersion;
    termsAcceptedAt;
    termsAcceptedByUserId;
    businessSegments;
    canSellProducts;
    canOfferServices;
    defaultPublicationChannels;
    pageSectionLabel;
    createdAt;
    updatedAt;
};
exports.CompanyClassifiedProfile = CompanyClassifiedProfile;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'uuid' }),
    __metadata("design:type", String)
], CompanyClassifiedProfile.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'ACTIVE' }),
    __metadata("design:type", String)
], CompanyClassifiedProfile.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], CompanyClassifiedProfile.prototype, "termsVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], CompanyClassifiedProfile.prototype, "termsAcceptedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CompanyClassifiedProfile.prototype, "termsAcceptedByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'::jsonb" }),
    __metadata("design:type", Array)
], CompanyClassifiedProfile.prototype, "businessSegments", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], CompanyClassifiedProfile.prototype, "canSellProducts", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], CompanyClassifiedProfile.prototype, "canOfferServices", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[\"CLASSIFIEDS\",\"COMPANY_PAGE\"]'::jsonb" }),
    __metadata("design:type", Array)
], CompanyClassifiedProfile.prototype, "defaultPublicationChannels", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], CompanyClassifiedProfile.prototype, "pageSectionLabel", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], CompanyClassifiedProfile.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], CompanyClassifiedProfile.prototype, "updatedAt", void 0);
exports.CompanyClassifiedProfile = CompanyClassifiedProfile = __decorate([
    (0, typeorm_1.Entity)('company_classified_profiles')
], CompanyClassifiedProfile);
//# sourceMappingURL=company-classified-profile.entity.js.map