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
exports.ClassifiedListing = void 0;
const typeorm_1 = require("typeorm");
let ClassifiedListing = class ClassifiedListing {
    id;
    slug;
    sellerUserId;
    companyId;
    categorySlug;
    listingType;
    title;
    description;
    price;
    priceType;
    condition;
    city;
    state;
    neighborhood;
    zipCode;
    latitude;
    longitude;
    deliveryModes;
    status;
    isFeatured;
    sellerVerifiedSnapshot;
    viewsCount;
    favoritesCount;
    attributes;
    publicationChannels;
    catalogConfig;
    commerceConfig;
    contactPhone;
    contactWhatsapp;
    moderationReason;
    duplicateOfListingId;
    moderationReviewedAt;
    publishedAt;
    expiresAt;
    createdAt;
    updatedAt;
};
exports.ClassifiedListing = ClassifiedListing;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 180 }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "sellerUserId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "categorySlug", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'PRODUCT' }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "listingType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 160 }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'FIXED' }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "priceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'USED' }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 2 }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 140, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "neighborhood", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "zipCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 7, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 7, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[\"ARRANGE\"]'::jsonb" }),
    __metadata("design:type", Array)
], ClassifiedListing.prototype, "deliveryModes", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'DRAFT' }),
    __metadata("design:type", String)
], ClassifiedListing.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ClassifiedListing.prototype, "isFeatured", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ClassifiedListing.prototype, "sellerVerifiedSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ClassifiedListing.prototype, "viewsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ClassifiedListing.prototype, "favoritesCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "attributes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[\"CLASSIFIEDS\"]'::jsonb" }),
    __metadata("design:type", Array)
], ClassifiedListing.prototype, "publicationChannels", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "catalogConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "commerceConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "contactPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "contactWhatsapp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "moderationReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "duplicateOfListingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "moderationReviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "publishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedListing.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ClassifiedListing.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ClassifiedListing.prototype, "updatedAt", void 0);
exports.ClassifiedListing = ClassifiedListing = __decorate([
    (0, typeorm_1.Entity)('classified_listings')
], ClassifiedListing);
//# sourceMappingURL=classified-listing.entity.js.map