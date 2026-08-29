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
exports.ExternalApiRequest = void 0;
const typeorm_1 = require("typeorm");
let ExternalApiRequest = class ExternalApiRequest {
    id;
    clientId;
    action;
    jobId;
    result;
    metadata;
    createdAt;
};
exports.ExternalApiRequest = ExternalApiRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExternalApiRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ExternalApiRequest.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 40 }),
    __metadata("design:type", String)
], ExternalApiRequest.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ExternalApiRequest.prototype, "jobId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 24 }),
    __metadata("design:type", String)
], ExternalApiRequest.prototype, "result", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ExternalApiRequest.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ExternalApiRequest.prototype, "createdAt", void 0);
exports.ExternalApiRequest = ExternalApiRequest = __decorate([
    (0, typeorm_1.Entity)('external_api_requests')
], ExternalApiRequest);
//# sourceMappingURL=external-api-request.entity.js.map