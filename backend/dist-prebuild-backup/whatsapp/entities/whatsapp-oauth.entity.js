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
exports.WhatsAppOAuthToken = exports.WhatsAppOAuthCode = exports.WhatsAppOAuthClient = void 0;
const typeorm_1 = require("typeorm");
let WhatsAppOAuthClient = class WhatsAppOAuthClient {
    id;
    clientId;
    clientName;
    redirectUris;
    tokenEndpointAuthMethod;
    active;
    createdAt;
    updatedAt;
};
exports.WhatsAppOAuthClient = WhatsAppOAuthClient;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WhatsAppOAuthClient.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, unique: true }),
    __metadata("design:type", String)
], WhatsAppOAuthClient.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppOAuthClient.prototype, "clientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'::jsonb" }),
    __metadata("design:type", Array)
], WhatsAppOAuthClient.prototype, "redirectUris", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, default: 'none' }),
    __metadata("design:type", String)
], WhatsAppOAuthClient.prototype, "tokenEndpointAuthMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], WhatsAppOAuthClient.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppOAuthClient.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppOAuthClient.prototype, "updatedAt", void 0);
exports.WhatsAppOAuthClient = WhatsAppOAuthClient = __decorate([
    (0, typeorm_1.Entity)('whatsapp_oauth_clients')
], WhatsAppOAuthClient);
let WhatsAppOAuthCode = class WhatsAppOAuthCode {
    id;
    codeHash;
    clientId;
    instanceId;
    redirectUri;
    resource;
    scopes;
    codeChallenge;
    expiresAt;
    usedAt;
    createdAt;
};
exports.WhatsAppOAuthCode = WhatsAppOAuthCode;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WhatsAppOAuthCode.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, unique: true }),
    __metadata("design:type", String)
], WhatsAppOAuthCode.prototype, "codeHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], WhatsAppOAuthCode.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], WhatsAppOAuthCode.prototype, "instanceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], WhatsAppOAuthCode.prototype, "redirectUri", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], WhatsAppOAuthCode.prototype, "resource", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'::jsonb" }),
    __metadata("design:type", Array)
], WhatsAppOAuthCode.prototype, "scopes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], WhatsAppOAuthCode.prototype, "codeChallenge", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], WhatsAppOAuthCode.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppOAuthCode.prototype, "usedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppOAuthCode.prototype, "createdAt", void 0);
exports.WhatsAppOAuthCode = WhatsAppOAuthCode = __decorate([
    (0, typeorm_1.Entity)('whatsapp_oauth_codes'),
    (0, typeorm_1.Index)(['instanceId', 'clientId'])
], WhatsAppOAuthCode);
let WhatsAppOAuthToken = class WhatsAppOAuthToken {
    id;
    instanceId;
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
exports.WhatsAppOAuthToken = WhatsAppOAuthToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WhatsAppOAuthToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], WhatsAppOAuthToken.prototype, "instanceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], WhatsAppOAuthToken.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, unique: true }),
    __metadata("design:type", String)
], WhatsAppOAuthToken.prototype, "accessTokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, unique: true }),
    __metadata("design:type", String)
], WhatsAppOAuthToken.prototype, "refreshTokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], WhatsAppOAuthToken.prototype, "resource", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'::jsonb" }),
    __metadata("design:type", Array)
], WhatsAppOAuthToken.prototype, "scopes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], WhatsAppOAuthToken.prototype, "accessExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], WhatsAppOAuthToken.prototype, "refreshExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppOAuthToken.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppOAuthToken.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppOAuthToken.prototype, "updatedAt", void 0);
exports.WhatsAppOAuthToken = WhatsAppOAuthToken = __decorate([
    (0, typeorm_1.Entity)('whatsapp_oauth_tokens'),
    (0, typeorm_1.Index)(['instanceId', 'clientId'])
], WhatsAppOAuthToken);
//# sourceMappingURL=whatsapp-oauth.entity.js.map