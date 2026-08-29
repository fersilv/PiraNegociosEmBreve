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
exports.WhatsAppPhoneOtp = exports.WhatsAppConversation = void 0;
const typeorm_1 = require("typeorm");
let WhatsAppConversation = class WhatsAppConversation {
    id;
    instanceId;
    chatId;
    whatsappId;
    phoneE164;
    userId;
    companyId;
    contextMode;
    activeFlow;
    state;
    lastInboundAt;
    lastProcessedAt;
    createdAt;
    updatedAt;
};
exports.WhatsAppConversation = WhatsAppConversation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WhatsAppConversation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], WhatsAppConversation.prototype, "instanceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], WhatsAppConversation.prototype, "chatId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppConversation.prototype, "whatsappId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppConversation.prototype, "phoneE164", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppConversation.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppConversation.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'UNRESOLVED' }),
    __metadata("design:type", String)
], WhatsAppConversation.prototype, "contextMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppConversation.prototype, "activeFlow", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], WhatsAppConversation.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppConversation.prototype, "lastInboundAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppConversation.prototype, "lastProcessedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppConversation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppConversation.prototype, "updatedAt", void 0);
exports.WhatsAppConversation = WhatsAppConversation = __decorate([
    (0, typeorm_1.Entity)('whatsapp_conversations'),
    (0, typeorm_1.Index)(['instanceId', 'chatId'], { unique: true })
], WhatsAppConversation);
let WhatsAppPhoneOtp = class WhatsAppPhoneOtp {
    id;
    userId;
    instanceId;
    phoneE164;
    whatsappId;
    codeHash;
    attempts;
    expiresAt;
    verifiedAt;
    createdAt;
};
exports.WhatsAppPhoneOtp = WhatsAppPhoneOtp;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WhatsAppPhoneOtp.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WhatsAppPhoneOtp.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], WhatsAppPhoneOtp.prototype, "instanceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], WhatsAppPhoneOtp.prototype, "phoneE164", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppPhoneOtp.prototype, "whatsappId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], WhatsAppPhoneOtp.prototype, "codeHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WhatsAppPhoneOtp.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], WhatsAppPhoneOtp.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppPhoneOtp.prototype, "verifiedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppPhoneOtp.prototype, "createdAt", void 0);
exports.WhatsAppPhoneOtp = WhatsAppPhoneOtp = __decorate([
    (0, typeorm_1.Entity)('whatsapp_phone_otps'),
    (0, typeorm_1.Index)(['userId', 'phoneE164'])
], WhatsAppPhoneOtp);
//# sourceMappingURL=whatsapp-concierge.entity.js.map