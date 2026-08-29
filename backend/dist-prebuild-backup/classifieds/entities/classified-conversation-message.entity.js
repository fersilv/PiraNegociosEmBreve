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
exports.ClassifiedConversationMessage = void 0;
const typeorm_1 = require("typeorm");
let ClassifiedConversationMessage = class ClassifiedConversationMessage {
    id;
    conversationId;
    senderId;
    senderName;
    senderRole;
    body;
    messageType;
    metadata;
    createdAt;
};
exports.ClassifiedConversationMessage = ClassifiedConversationMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ClassifiedConversationMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], ClassifiedConversationMessage.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], ClassifiedConversationMessage.prototype, "senderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 160 }),
    __metadata("design:type", String)
], ClassifiedConversationMessage.prototype, "senderName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], ClassifiedConversationMessage.prototype, "senderRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ClassifiedConversationMessage.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'TEXT' }),
    __metadata("design:type", String)
], ClassifiedConversationMessage.prototype, "messageType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ClassifiedConversationMessage.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ClassifiedConversationMessage.prototype, "createdAt", void 0);
exports.ClassifiedConversationMessage = ClassifiedConversationMessage = __decorate([
    (0, typeorm_1.Entity)('classified_conversation_messages'),
    (0, typeorm_1.Index)(['conversationId', 'createdAt'])
], ClassifiedConversationMessage);
//# sourceMappingURL=classified-conversation-message.entity.js.map