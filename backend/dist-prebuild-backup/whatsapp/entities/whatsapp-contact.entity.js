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
exports.WhatsAppSavedContact = void 0;
const typeorm_1 = require("typeorm");
let WhatsAppSavedContact = class WhatsAppSavedContact {
    id;
    instanceId;
    waId;
    phoneNumber;
    name;
    notes;
    metadata;
    createdAt;
    updatedAt;
};
exports.WhatsAppSavedContact = WhatsAppSavedContact;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WhatsAppSavedContact.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], WhatsAppSavedContact.prototype, "instanceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 120 }),
    __metadata("design:type", String)
], WhatsAppSavedContact.prototype, "waId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 32 }),
    __metadata("design:type", String)
], WhatsAppSavedContact.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 160 }),
    __metadata("design:type", String)
], WhatsAppSavedContact.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppSavedContact.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppSavedContact.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppSavedContact.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppSavedContact.prototype, "updatedAt", void 0);
exports.WhatsAppSavedContact = WhatsAppSavedContact = __decorate([
    (0, typeorm_1.Entity)('whatsapp_saved_contacts'),
    (0, typeorm_1.Index)(['instanceId', 'waId'], { unique: true })
], WhatsAppSavedContact);
//# sourceMappingURL=whatsapp-contact.entity.js.map