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
exports.WhatsAppAdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const admin_guard_1 = require("../admin/admin.guard");
const auth_guard_1 = require("../auth/auth.guard");
const whatsapp_api_key_entity_1 = require("./entities/whatsapp-api-key.entity");
const whatsapp_scopes_1 = require("./whatsapp.scopes");
const whatsapp_service_1 = require("./whatsapp.service");
let WhatsAppAdminController = class WhatsAppAdminController {
    whatsapp;
    keysRepository;
    constructor(whatsapp, keysRepository) {
        this.whatsapp = whatsapp;
        this.keysRepository = keysRepository;
    }
    capabilities() {
        return whatsapp_scopes_1.WHATSAPP_CAPABILITIES;
    }
    listInstances() {
        return this.whatsapp.listInstances();
    }
    createInstance(req, body) {
        return this.whatsapp.createInstance(req.user.uid, body);
    }
    getInstance(id) {
        return this.whatsapp.status(id);
    }
    updateInstance(id, body) {
        return this.whatsapp.updateInstance(id, body);
    }
    removeInstance(id) {
        return this.whatsapp.removeInstance(id);
    }
    connect(id) {
        return this.whatsapp.connect(id);
    }
    disconnect(id, body) {
        return this.whatsapp.disconnect(id, Boolean(body?.logout));
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
    channels(id) {
        return this.whatsapp.listChannels(id);
    }
    messages(id, limit) {
        return this.whatsapp.listMessages(id, Number(limit || 50));
    }
    testMessage(id, body) {
        return this.whatsapp.sendText(id, String(body.target || ''), String(body.text || ''));
    }
    keys(id) {
        return this.whatsapp.listKeys(id);
    }
    createKey(req, id, body) {
        return this.whatsapp.createKey(id, req.user.uid, body);
    }
    updateKey(keyId, body) {
        return this.whatsapp.updateKey(keyId, body);
    }
    rotateKey(keyId) {
        return this.whatsapp.rotateKey(keyId);
    }
    async removeKey(keyId) {
        const key = await this.keysRepository.findOne({ where: { id: keyId } });
        if (!key)
            throw new common_1.NotFoundException('Chave do WhatsApp não encontrada.');
        await this.keysRepository.remove(key);
        return { ok: true };
    }
};
exports.WhatsAppAdminController = WhatsAppAdminController;
__decorate([
    (0, common_1.Get)('capabilities'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "capabilities", null);
__decorate([
    (0, common_1.Get)('instances'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "listInstances", null);
__decorate([
    (0, common_1.Post)('instances'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "createInstance", null);
__decorate([
    (0, common_1.Get)('instances/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "getInstance", null);
__decorate([
    (0, common_1.Put)('instances/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "updateInstance", null);
__decorate([
    (0, common_1.Delete)('instances/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "removeInstance", null);
__decorate([
    (0, common_1.Post)('instances/:id/connect'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "connect", null);
__decorate([
    (0, common_1.Post)('instances/:id/disconnect'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Get)('instances/:id/contacts'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "contacts", null);
__decorate([
    (0, common_1.Get)('instances/:id/saved-contacts'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "savedContacts", null);
__decorate([
    (0, common_1.Post)('instances/:id/saved-contacts'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "saveContact", null);
__decorate([
    (0, common_1.Get)('instances/:id/groups'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "groups", null);
__decorate([
    (0, common_1.Get)('instances/:id/channels'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "channels", null);
__decorate([
    (0, common_1.Get)('instances/:id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)('instances/:id/test-message'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "testMessage", null);
__decorate([
    (0, common_1.Get)('instances/:id/keys'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "keys", null);
__decorate([
    (0, common_1.Post)('instances/:id/keys'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "createKey", null);
__decorate([
    (0, common_1.Put)('keys/:keyId'),
    __param(0, (0, common_1.Param)('keyId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "updateKey", null);
__decorate([
    (0, common_1.Post)('keys/:keyId/rotate'),
    __param(0, (0, common_1.Param)('keyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WhatsAppAdminController.prototype, "rotateKey", null);
__decorate([
    (0, common_1.Delete)('keys/:keyId'),
    __param(0, (0, common_1.Param)('keyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WhatsAppAdminController.prototype, "removeKey", null);
exports.WhatsAppAdminController = WhatsAppAdminController = __decorate([
    (0, common_1.Controller)('admin/whatsapp'),
    (0, common_1.UseGuards)(auth_guard_1.FirebaseAuthGuard, admin_guard_1.AdminGuard),
    __param(1, (0, typeorm_1.InjectRepository)(whatsapp_api_key_entity_1.WhatsAppApiKey)),
    __metadata("design:paramtypes", [whatsapp_service_1.WhatsAppService,
        typeorm_2.Repository])
], WhatsAppAdminController);
//# sourceMappingURL=whatsapp-admin.controller.js.map