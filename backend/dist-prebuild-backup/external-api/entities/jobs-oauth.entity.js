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
exports.JobsOAuthToken = exports.JobsOAuthCode = exports.JobsOAuthClient = void 0;
const typeorm_1 = require("typeorm");
let JobsOAuthClient = class JobsOAuthClient {
    id;
    clientId;
    clientName;
    redirectUris;
    tokenEndpointAuthMethod;
    active;
    createdAt;
    updatedAt;
};
exports.JobsOAuthClient = JobsOAuthClient;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], JobsOAuthClient.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, unique: true }),
    __metadata("design:type", String)
], JobsOAuthClient.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], JobsOAuthClient.prototype, "clientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'::jsonb" }),
    __metadata("design:type", Array)
], JobsOAuthClient.prototype, "redirectUris", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, default: 'none' }),
    __metadata("design:type", String)
], JobsOAuthClient.prototype, "tokenEndpointAuthMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], JobsOAuthClient.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], JobsOAuthClient.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], JobsOAuthClient.prototype, "updatedAt", void 0);
exports.JobsOAuthClient = JobsOAuthClient = __decorate([
    (0, typeorm_1.Entity)('jobs_oauth_clients')
], JobsOAuthClient);
let JobsOAuthCode = class JobsOAuthCode {
    id;
    codeHash;
    clientId;
    apiClientId;
    redirectUri;
    resource;
    scopes;
    codeChallenge;
    expiresAt;
    usedAt;
    createdAt;
};
exports.JobsOAuthCode = JobsOAuthCode;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], JobsOAuthCode.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, unique: true }),
    __metadata("design:type", String)
], JobsOAuthCode.prototype, "codeHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], JobsOAuthCode.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], JobsOAuthCode.prototype, "apiClientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], JobsOAuthCode.prototype, "redirectUri", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], JobsOAuthCode.prototype, "resource", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'::jsonb" }),
    __metadata("design:type", Array)
], JobsOAuthCode.prototype, "scopes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], JobsOAuthCode.prototype, "codeChallenge", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], JobsOAuthCode.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], JobsOAuthCode.prototype, "usedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], JobsOAuthCode.prototype, "createdAt", void 0);
exports.JobsOAuthCode = JobsOAuthCode = __decorate([
    (0, typeorm_1.Entity)('jobs_oauth_codes'),
    (0, typeorm_1.Index)(['apiClientId', 'clientId'])
], JobsOAuthCode);
let JobsOAuthToken = class JobsOAuthToken {
    id;
    apiClientId;
    clientId;
    accessTokenHash;
    refreshTokenHash;
    resource;
    scopes;
    accessExpiresAt;
    refreshExpiresAt;
    revokedAt;
    createdAt;
    updatedAt;
};
exports.JobsOAuthToken = JobsOAuthToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], JobsOAuthToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], JobsOAuthToken.prototype, "apiClientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], JobsOAuthToken.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, unique: true }),
    __metadata("design:type", String)
], JobsOAuthToken.prototype, "accessTokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, unique: true }),
    __metadata("design:type", String)
], JobsOAuthToken.prototype, "refreshTokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], JobsOAuthToken.prototype, "resource", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'::jsonb" }),
    __metadata("design:type", Array)
], JobsOAuthToken.prototype, "scopes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], JobsOAuthToken.prototype, "accessExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], JobsOAuthToken.prototype, "refreshExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], JobsOAuthToken.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], JobsOAuthToken.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], JobsOAuthToken.prototype, "updatedAt", void 0);
exports.JobsOAuthToken = JobsOAuthToken = __decorate([
    (0, typeorm_1.Entity)('jobs_oauth_tokens'),
    (0, typeorm_1.Index)(['apiClientId', 'clientId'])
], JobsOAuthToken);
//# sourceMappingURL=jobs-oauth.entity.js.map