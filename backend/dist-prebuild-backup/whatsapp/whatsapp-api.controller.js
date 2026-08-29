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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppApiController = void 0;
const common_1 = require("@nestjs/common");
const whatsapp_key_guard_1 = require("./whatsapp-key.guard");
const whatsapp_service_1 = require("./whatsapp.service");
let WhatsAppApiController = class WhatsAppApiController {
    whatsapp;
    constructor(whatsapp) {
        this.whatsapp = whatsapp;
    }
    async status(id) {
        return this.publicStatus(await this.whatsapp.status(id));
    }
    messages(id, limit) {
        return this.whatsapp.listMessages(id, Number(limit || 50));
    }
    sendMessage(id, body) {
        if (body.media)
            return this.whatsapp.sendMedia(id, String(body.target || ''), body.media, body.filename, body.caption);
        return this.whatsapp.sendText(id, String(body.target || ''), String(body.text || ''));
    }
    contacts(id) {
        return this.whatsapp.listContacts(id);
    }
    savedContacts(id) {
        return this.whatsapp.listSavedContacts(id);
    }
    saveContact(id, body) {
        return this.whatsapp.saveContact(id, body);
    }
    groups(id) {
        return this.whatsapp.listGroups(id);
    }
    groupMessage(id, groupId, body) {
        return this.whatsapp.sendText(id, groupId, String(body.text || ''));
    }
    channels(id) {
        return this.whatsapp.listChannels(id);
    }
    channelPost(id, channelId, body) {
        return this.whatsapp.publishChannel(id, channelId, String(body.text || ''));
    }
    publishStatus(id, body) {
        return this.whatsapp.publishStatus(id, body);
    }
    publicStatus(value) {
        return {
            id: value.id,
            name: value.name,
            purpose: value.purpose,
            phoneNumber: value.phoneNumber,
            provider: value.provider,
            status: value.status,
            active: value.active,
            connected: value.connected,
            lastConnectedAt: value.lastConnectedAt,
            lastSeenAt: value.lastSeenAt,
            runtimeDetail: value.runtimeDetail,
            capabilities: value.capabilities,
        };
    }
};
exports.WhatsAppApiController = WhatsAppApiController;
__decorate([
    (0, common_1.Get)('status'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('connection:read'),
    __param(0, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsAppApiController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('messages'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('messages:read'),
    __param(0, (0, common_1.Param)('instanceId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)('messages'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('messages:send'),
    __param(0, (0, common_1.Param)('instanceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)('contacts'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('contacts:read'),
    __param(0, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "contacts", null);
__decorate([
    (0, common_1.Get)('contacts/saved'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('contacts:read'),
    __param(0, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "savedContacts", null);
__decorate([
    (0, common_1.Post)('contacts/saved'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('contacts:write'),
    __param(0, (0, common_1.Param)('instanceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "saveContact", null);
__decorate([
    (0, common_1.Get)('groups'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('groups:read'),
    __param(0, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "groups", null);
__decorate([
    (0, common_1.Post)('groups/:groupId/messages'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('groups:send'),
    __param(0, (0, common_1.Param)('instanceId')),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "groupMessage", null);
__decorate([
    (0, common_1.Get)('channels'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('channels:read'),
    __param(0, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "channels", null);
__decorate([
    (0, common_1.Post)('channels/:channelId/posts'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('channels:publish'),
    __param(0, (0, common_1.Param)('instanceId')),
    __param(1, (0, common_1.Param)('channelId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "channelPost", null);
__decorate([
    (0, common_1.Post)('status'),
    (0, whatsapp_key_guard_1.RequireWhatsAppScope)('status:publish'),
    __param(0, (0, common_1.Param)('instanceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppApiController.prototype, "publishStatus", null);
exports.WhatsAppApiController = WhatsAppApiController = __decorate([
    (0, common_1.Controller)('whatsapp/v1/:instanceId'),
    (0, common_1.UseGuards)(whatsapp_key_guard_1.WhatsAppApiKeyGuard),
    __metadata("design:paramtypes", [whatsapp_service_1.WhatsAppService])
], WhatsAppApiController);
//# sourceMappingURL=whatsapp-api.controller.js.map