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
exports.ClassifiedUserPreference = void 0;
const typeorm_1 = require("typeorm");
let ClassifiedUserPreference = class ClassifiedUserPreference {
    userId;
    lastIdentityType;
    lastCompanyId;
    personalTermsVersion;
    personalTermsAcceptedAt;
    createdAt;
    updatedAt;
};
exports.ClassifiedUserPreference = ClassifiedUserPreference;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], ClassifiedUserPreference.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedUserPreference.prototype, "lastIdentityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedUserPreference.prototype, "lastCompanyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], ClassifiedUserPreference.prototype, "personalTermsVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedUserPreference.prototype, "personalTermsAcceptedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ClassifiedUserPreference.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ClassifiedUserPreference.prototype, "updatedAt", void 0);
exports.ClassifiedUserPreference = ClassifiedUserPreference = __decorate([
    (0, typeorm_1.Entity)('classified_user_preferences')
], ClassifiedUserPreference);
//# sourceMappingURL=classified-user-preference.entity.js.map