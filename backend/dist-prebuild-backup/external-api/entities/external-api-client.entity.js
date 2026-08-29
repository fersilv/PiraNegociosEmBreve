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
exports.ExternalApiClient = void 0;
const typeorm_1 = require("typeorm");
let ExternalApiClient = class ExternalApiClient {
    id;
    name;
    sourceLabel;
    keyPrefix;
    keyHash;
    scopes;
    apiVersion;
    audience;
    active;
    createdById;
    lastUsedAt;
    createdAt;
    updatedAt;
};
exports.ExternalApiClient = ExternalApiClient;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExternalApiClient.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 120 }),
    __metadata("design:type", String)
], ExternalApiClient.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 160 }),
    __metadata("design:type", String)
], ExternalApiClient.prototype, "sourceLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20, unique: true }),
    __metadata("design:type", String)
], ExternalApiClient.prototype, "keyPrefix", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], ExternalApiClient.prototype, "keyHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => '\'["jobs:read","jobs:write"]\'' }),
    __metadata("design:type", Array)
], ExternalApiClient.prototype, "scopes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8, default: 'v1' }),
    __metadata("design:type", String)
], ExternalApiClient.prototype, "apiVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 12, default: 'api' }),
    __metadata("design:type", String)
], ExternalApiClient.prototype, "audience", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ExternalApiClient.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ExternalApiClient.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ExternalApiClient.prototype, "lastUsedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ExternalApiClient.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ExternalApiClient.prototype, "updatedAt", void 0);
exports.ExternalApiClient = ExternalApiClient = __decorate([
    (0, typeorm_1.Entity)('external_api_clients')
], ExternalApiClient);
//# sourceMappingURL=external-api-client.entity.js.map