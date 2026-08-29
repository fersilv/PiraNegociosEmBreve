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
exports.WhatsAppInstance = exports.WhatsAppConnectionStatus = void 0;
const typeorm_1 = require("typeorm");
var WhatsAppConnectionStatus;
(function (WhatsAppConnectionStatus) {
    WhatsAppConnectionStatus["DISCONNECTED"] = "DISCONNECTED";
    WhatsAppConnectionStatus["CONNECTING"] = "CONNECTING";
    WhatsAppConnectionStatus["QR_REQUIRED"] = "QR_REQUIRED";
    WhatsAppConnectionStatus["CONNECTED"] = "CONNECTED";
    WhatsAppConnectionStatus["ERROR"] = "ERROR";
})(WhatsAppConnectionStatus || (exports.WhatsAppConnectionStatus = WhatsAppConnectionStatus = {}));
let WhatsAppInstance = class WhatsAppInstance {
    id;
    name;
    purpose;
    phoneNumber;
    sessionName;
    provider;
    status;
    allowedScopes;
    active;
    isPrimarySupport;
    conciergeEnabled;
    lastError;
    lastConnectedAt;
    lastSeenAt;
    createdById;
    createdAt;
    updatedAt;
};
exports.WhatsAppInstance = WhatsAppInstance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WhatsAppInstance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], WhatsAppInstance.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppInstance.prototype, "purpose", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], WhatsAppInstance.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 40, unique: true }),
    __metadata("design:type", String)
], WhatsAppInstance.prototype, "sessionName", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 30, default: 'wppconnect' }),
    __metadata("design:type", String)
], WhatsAppInstance.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: WhatsAppConnectionStatus,
        enumName: 'whatsapp_connection_status_enum',
        default: WhatsAppConnectionStatus.DISCONNECTED,
    }),
    __metadata("design:type", String)
], WhatsAppInstance.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'::jsonb" }),
    __metadata("design:type", Array)
], WhatsAppInstance.prototype, "allowedScopes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], WhatsAppInstance.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], WhatsAppInstance.prototype, "isPrimarySupport", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], WhatsAppInstance.prototype, "conciergeEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppInstance.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppInstance.prototype, "lastConnectedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], WhatsAppInstance.prototype, "lastSeenAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WhatsAppInstance.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppInstance.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WhatsAppInstance.prototype, "updatedAt", void 0);
exports.WhatsAppInstance = WhatsAppInstance = __decorate([
    (0, typeorm_1.Entity)('whatsapp_instances')
], WhatsAppInstance);
//# sourceMappingURL=whatsapp-instance.entity.js.map