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
exports.WhatsAppMessage = exports.WhatsAppMessageDirection = void 0;
const typeorm_1 = require("typeorm");
var WhatsAppMessageDirection;
(function (WhatsAppMessageDirection) {
    WhatsAppMessageDirection["INBOUND"] = "INBOUND";
    WhatsAppMessageDirection["OUTBOUND"] = "OUTBOUND";
})(WhatsAppMessageDirection || (exports.WhatsAppMessageDirection = WhatsAppMessageDirection = {}));
let WhatsAppMessage = class WhatsAppMessage {
    id;
    instanceId;
    providerMessageId;
    chatId;
    senderId;
    direction;
    type;
    body;
    metadata;
    providerTimestamp;
    createdAt;
};
exports.WhatsAppMessage = WhatsAppMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WhatsAppMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], WhatsAppMessage.prototype, "instanceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppMessage.prototype, "providerMessageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 120 }),
    __metadata("design:type", String)
], WhatsAppMessage.prototype, "chatId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppMessage.prototype, "senderId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: WhatsAppMessageDirection,
        enumName: 'whatsapp_message_direction_enum',
    }),
    __metadata("design:type", String)
], WhatsAppMessage.prototype, "direction", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 40, default: 'text' }),
    __metadata("design:type", String)
], WhatsAppMessage.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppMessage.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppMessage.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppMessage.prototype, "providerTimestamp", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppMessage.prototype, "createdAt", void 0);
exports.WhatsAppMessage = WhatsAppMessage = __decorate([
    (0, typeorm_1.Entity)('whatsapp_messages'),
    (0, typeorm_1.Index)(['instanceId', 'createdAt'])
], WhatsAppMessage);
//# sourceMappingURL=whatsapp-message.entity.js.map