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
exports.ClassifiedCategory = void 0;
const typeorm_1 = require("typeorm");
let ClassifiedCategory = class ClassifiedCategory {
    slug;
    name;
    icon;
    parentSlug;
    sortOrder;
    isActive;
    attributeSchema;
    createdAt;
    updatedAt;
};
exports.ClassifiedCategory = ClassifiedCategory;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], ClassifiedCategory.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], ClassifiedCategory.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 60, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedCategory.prototype, "icon", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedCategory.prototype, "parentSlug", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ClassifiedCategory.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ClassifiedCategory.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedCategory.prototype, "attributeSchema", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ClassifiedCategory.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ClassifiedCategory.prototype, "updatedAt", void 0);
exports.ClassifiedCategory = ClassifiedCategory = __decorate([
    (0, typeorm_1.Entity)('classified_categories')
], ClassifiedCategory);
//# sourceMappingURL=classified-category.entity.js.map