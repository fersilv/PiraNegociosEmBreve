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
exports.AdvertisingConfig = void 0;
const typeorm_1 = require("typeorm");
let AdvertisingConfig = class AdvertisingConfig {
    id;
    googleAdsEnabled;
    googleAdsClient;
    googleAdsSlotLeaderboard;
    googleAdsSlotRectangle;
    updatedAt;
};
exports.AdvertisingConfig = AdvertisingConfig;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ default: 'default' }),
    __metadata("design:type", String)
], AdvertisingConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], AdvertisingConfig.prototype, "googleAdsEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], AdvertisingConfig.prototype, "googleAdsClient", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], AdvertisingConfig.prototype, "googleAdsSlotLeaderboard", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], AdvertisingConfig.prototype, "googleAdsSlotRectangle", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], AdvertisingConfig.prototype, "updatedAt", void 0);
exports.AdvertisingConfig = AdvertisingConfig = __decorate([
    (0, typeorm_1.Entity)('advertising_configs')
], AdvertisingConfig);
//# sourceMappingURL=advertising-config.entity.js.map