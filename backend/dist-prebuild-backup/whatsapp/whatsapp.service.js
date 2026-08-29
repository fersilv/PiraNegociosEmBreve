"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var WhatsAppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const path_1 = require("path");
const typeorm_2 = require("typeorm");
const wppconnect = __importStar(require("@wppconnect-team/wppconnect"));
const whatsapp_api_key_entity_1 = require("./entities/whatsapp-api-key.entity");
const whatsapp_contact_entity_1 = require("./entities/whatsapp-contact.entity");
const whatsapp_instance_entity_1 = require("./entities/whatsapp-instance.entity");
const whatsapp_message_entity_1 = require("./entities/whatsapp-message.entity");
const whatsapp_alert_service_1 = require("./whatsapp-alert.service");
const whatsapp_concierge_service_1 = require("./whatsapp-concierge.service");
const whatsapp_scopes_1 = require("./whatsapp.scopes");
let WhatsAppService = WhatsAppService_1 = class WhatsAppService {
    instances;
    keys;
    messages;
    savedContacts;
    concierge;
    alerts;
    logger = new common_1.Logger(WhatsAppService_1.name);
    clients = new Map();
    states = new Map();
    connecting = new Map();
    expectedDisconnects = new Set();
    constructor(instances, keys, messages, savedContacts, concierge, alerts) {
        this.instances = instances;
        this.keys = keys;
        this.messages = messages;
        this.savedContacts = savedContacts;
        this.concierge = concierge;
        this.alerts = alerts;
    }
    async onModuleInit() {
        const recoverable = await this.instances.find({ where: { active: true } });
        for (const instance of recoverable) {
            if (!instance.lastConnectedAt)
                continue;
            void this.connect(instance.id).catch((error) => this.logger.warn(`Não foi possível restaurar automaticamente a sessão ${instance.id}: ${this.errorMessage(error)}`));
        }
    }
    async onModuleDestroy() {
        await Promise.allSettled([...this.clients.values()].map((client) => Promise.resolve(client.close?.())));
    }
    async listInstances() {
        const rows = await this.instances.find({ order: { createdAt: 'DESC' } });
        return Promise.all(rows.map((instance) => this.decorateInstance(instance)));
    }
    async getInstance(id) {
        const instance = await this.instances.findOne({ where: { id } });
        if (!instance)
            throw new common_1.NotFoundException('Número do WhatsApp não encontrado.');
        return instance;
    }
    async createInstance(createdById, data) {
        const name = String(data.name || '').trim().slice(0, 100);
        if (!name)
            throw new common_1.BadRequestException('Informe um nome para identificar este número.');
        const purpose = String(data.purpose || '').trim().slice(0, 180) || null;
        const phoneNumber = this.onlyDigits(String(data.phoneNumber || '')) || null;
        const allowedScopes = (0, whatsapp_scopes_1.sanitizeWhatsAppScopes)(data.allowedScopes);
        const instance = await this.instances.save(this.instances.create({
            name,
            purpose,
            phoneNumber,
            sessionName: `pn-${(0, crypto_1.randomBytes)(12).toString('hex')}`,
            provider: 'wppconnect',
            status: whatsapp_instance_entity_1.WhatsAppConnectionStatus.DISCONNECTED,
            allowedScopes,
            active: true,
            isPrimarySupport: false,
            conciergeEnabled: false,
            lastError: null,
            lastConnectedAt: null,
            lastSeenAt: null,
            createdById,
        }));
        return this.decorateInstance(instance);
    }
    async updateInstance(id, data) {
        const instance = await this.getInstance(id);
        if (typeof data.name === 'string' && data.name.trim())
            instance.name = data.name.trim().slice(0, 100);
        if (typeof data.purpose === 'string')
            instance.purpose = data.purpose.trim().slice(0, 180) || null;
        if (typeof data.phoneNumber === 'string')
            instance.phoneNumber = this.onlyDigits(data.phoneNumber) || null;
        if (typeof data.active === 'boolean')
            instance.active = data.active;
        if (typeof data.conciergeEnabled === 'boolean')
            instance.conciergeEnabled = data.conciergeEnabled;
        if (typeof data.isPrimarySupport === 'boolean') {
            if (data.isPrimarySupport) {
                await this.instances.createQueryBuilder()
                    .update(whatsapp_instance_entity_1.WhatsAppInstance)
                    .set({ isPrimarySupport: false })
                    .where('id != :id', { id })
                    .execute();
            }
            instance.isPrimarySupport = data.isPrimarySupport;
        }
        if (Array.isArray(data.allowedScopes))
            instance.allowedScopes = (0, whatsapp_scopes_1.sanitizeWhatsAppScopes)(data.allowedScopes);
        await this.instances.save(instance);
        return this.decorateInstance(instance);
    }
    async removeInstance(id) {
        await this.disconnect(id, false).catch(() => undefined);
        const instance = await this.getInstance(id);
        await this.instances.remove(instance);
        this.states.delete(id);
        return { ok: true };
    }
    async connect(id) {
        const instance = await this.getInstance(id);
        if (!instance.active)
            throw new common_1.BadRequestException('Ative o número antes de conectar.');
        if (this.clients.has(id) || this.connecting.has(id))
            return this.status(id);
        await this.setStatus(instance, whatsapp_instance_entity_1.WhatsAppConnectionStatus.CONNECTING, null);
        this.setRuntime(id, { qrCode: null, detail: 'Abrindo sessão do WhatsApp Web...' });
        const task = this.connectInternal(instance)
            .catch((error) => {
            this.logger.error(`Falha ao abrir sessão WhatsApp ${id}: ${this.errorMessage(error)}`);
        })
            .finally(() => {
            this.connecting.delete(id);
        });
        this.connecting.set(id, task);
        return this.status(id);
    }
    async connectInternal(instance) {
        const id = instance.id;
        if (this.clients.has(id))
            return;
        const sessionDir = process.env.WHATSAPP_SESSION_DIR || (0, path_1.join)(process.cwd(), 'whatsapp-sessions');
        try {
            const client = await wppconnect.create({
                session: instance.sessionName,
                folderNameToken: sessionDir,
                headless: true,
                logQR: false,
                autoClose: 0,
                disableWelcome: true,
                updatesLog: false,
                useChrome: process.env.WHATSAPP_USE_CHROME === 'true',
                browserArgs: [
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    ...(process.env.WHATSAPP_NO_SANDBOX === 'true'
                        ? ['--no-sandbox', '--disable-setuid-sandbox']
                        : []),
                ],
                catchQR: (base64Qr) => {
                    const qrCode = base64Qr.startsWith('data:') ? base64Qr : `data:image/png;base64,${base64Qr}`;
                    this.setRuntime(id, { qrCode, detail: 'Leia o QR Code no WhatsApp do aparelho.' });
                    void this.setStatusById(id, whatsapp_instance_entity_1.WhatsAppConnectionStatus.QR_REQUIRED, null);
                },
                statusFind: (statusSession) => {
                    const status = String(statusSession || '').toLowerCase();
                    if (status.includes('logged') && !status.includes('notlogged')) {
                        this.setRuntime(id, { qrCode: null, detail: 'Sessão autenticada.' });
                        void this.setStatusById(id, whatsapp_instance_entity_1.WhatsAppConnectionStatus.CONNECTED, null, true);
                    }
                    else if (status.includes('notlogged')) {
                        void this.setStatusById(id, whatsapp_instance_entity_1.WhatsAppConnectionStatus.QR_REQUIRED, null);
                    }
                    else if (status.includes('disconnect') ||
                        status.includes('browserclose') ||
                        status.includes('serverclose') ||
                        status.includes('delete')) {
                        this.clients.delete(id);
                        void this.setStatusById(id, whatsapp_instance_entity_1.WhatsAppConnectionStatus.DISCONNECTED, statusSession);
                        void this.notifyUnexpectedDisconnect(instance, `statusFind: ${statusSession}`);
                    }
                },
            });
            this.clients.set(id, client);
            this.setRuntime(id, { qrCode: null, detail: 'Conectado e recebendo eventos.' });
            await this.setStatusById(id, whatsapp_instance_entity_1.WhatsAppConnectionStatus.CONNECTED, null, true);
            await this.capturePhoneNumber(instance, client);
            client.onMessage?.((message) => {
                void (async () => {
                    await this.storeInbound(instance.id, message);
                    const currentInstance = await this.getInstance(instance.id);
                    if (currentInstance.conciergeEnabled) {
                        await this.concierge.handleInbound(currentInstance, message, client);
                    }
                })().catch(async (error) => {
                    this.logger.error(`Falha ao processar mensagem WhatsApp ${instance.id}: ${this.errorMessage(error)}`);
                    await this.alerts.send({
                        severity: 'ATTENTION',
                        title: 'Erro ao processar mensagem recebida no WhatsApp',
                        instanceName: instance.name,
                        instanceId: instance.id,
                        error,
                        context: { messageId: this.serializeWid(message?.id), type: message?.type },
                    });
                });
            });
            client.onStateChange?.((state) => {
                const value = String(state || '');
                if (/DISCONNECTED|UNPAIRED|UNLAUNCHED|CONFLICT/i.test(value)) {
                    this.clients.delete(id);
                    void this.setStatusById(id, whatsapp_instance_entity_1.WhatsAppConnectionStatus.DISCONNECTED, value);
                    void this.notifyUnexpectedDisconnect(instance, `onStateChange: ${value}`);
                }
            });
        }
        catch (error) {
            const detail = this.errorMessage(error);
            this.logger.error(`Falha ao conectar WhatsApp ${id}: ${detail}`);
            this.setRuntime(id, { qrCode: null, detail });
            await this.setStatusById(id, whatsapp_instance_entity_1.WhatsAppConnectionStatus.ERROR, detail);
            await this.alerts.send({
                severity: instance.isPrimarySupport ? 'CRITICAL' : 'ATTENTION',
                title: 'Falha ao conectar sessão do WhatsApp',
                instanceName: instance.name,
                instanceId: instance.id,
                error,
                context: { primarySupport: instance.isPrimarySupport },
            });
        }
    }
    async disconnect(id, logout = false) {
        const instance = await this.getInstance(id);
        const client = this.clients.get(id);
        this.expectedDisconnects.add(id);
        try {
            if (client) {
                try {
                    if (logout && typeof client.logout === 'function')
                        await client.logout();
                    else if (typeof client.close === 'function')
                        await client.close();
                }
                finally {
                    this.clients.delete(id);
                }
            }
            this.setRuntime(id, { qrCode: null, detail: logout ? 'Aparelho desvinculado.' : 'Sessão parada.' });
            await this.setStatus(instance, whatsapp_instance_entity_1.WhatsAppConnectionStatus.DISCONNECTED, null);
            return this.status(id);
        }
        finally {
            setTimeout(() => this.expectedDisconnects.delete(id), 10_000);
        }
    }
    async status(id) {
        const instance = await this.getInstance(id);
        return this.decorateInstance(instance);
    }
    async checkNumberStatus(id, phone) {
        const client = this.requireClient(id);
        const digits = this.onlyDigits(phone);
        if (!digits)
            throw new common_1.BadRequestException('Telefone inválido.');
        return client.checkNumberStatus(`${digits}@c.us`);
    }
    async resolvePnLid(id, phoneOrLid) {
        const client = this.requireClient(id);
        const target = String(phoneOrLid || '').trim();
        if (!target)
            throw new common_1.BadRequestException('Identificador do WhatsApp inválido.');
        return client.getPnLidEntry(target.includes('@') ? target : `${this.onlyDigits(target)}@c.us`);
    }
    async listContacts(id) {
        const client = this.requireClient(id);
        const contacts = await client.getAllContacts();
        return Array.isArray(contacts) ? contacts : [];
    }
    async listGroups(id) {
        const client = this.requireClient(id);
        const chats = await client.listChats({ onlyGroups: true });
        if (!Array.isArray(chats))
            return [];
        return chats.filter((chat) => {
            const serialized = this.serializeWid(chat?.id);
            return serialized.endsWith('@g.us');
        });
    }
    async getGroupHistory(id, groupId, options) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const count = Math.min(500, Math.max(1, Number(options?.count || 100)));
        const params = { count };
        if (options?.beforeMessageId) {
            params.id = String(options.beforeMessageId);
            params.direction = 'before';
        }
        if (options?.media)
            params.media = options.media;
        const rows = await client.getMessages(target, params);
        return Array.isArray(rows) ? rows.map((message) => this.publicMessage(message)) : [];
    }
    async getGroupMedia(id, messageId) {
        const client = this.requireClient(id);
        const message = await client.getMessageById(String(messageId || '').trim());
        if (!message)
            throw new common_1.NotFoundException('Mensagem não encontrada no WhatsApp.');
        const data = await client.downloadMedia(message);
        const mimeType = String(message?.mimetype || message?.mimeType || 'application/octet-stream');
        return {
            message: this.publicMessage(message),
            mimeType,
            data: typeof data === 'string' ? data.replace(/^data:[^;]+;base64,/, '') : '',
        };
    }
    async listGroupMembers(id, groupId) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const members = await client.getGroupMembers(target);
        return Array.isArray(members) ? members : [];
    }
    async joinGroup(id, inviteCodeOrLink) {
        const client = this.requireClient(id);
        const invite = String(inviteCodeOrLink || '').trim();
        if (!invite)
            throw new common_1.BadRequestException('Informe o link ou código de convite do grupo.');
        const info = await client.getGroupInfoFromInviteLink(invite).catch(() => null);
        const result = await client.joinGroup(invite);
        return { ok: true, info, result };
    }
    async addGroupParticipant(id, groupId, participantId) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const participant = this.normalizeParticipantId(participantId);
        const result = await client.addParticipant(target, participant);
        return { ok: true, groupId: target, participantId: participant, result };
    }
    async removeGroupParticipant(id, groupId, participantId) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const participant = this.normalizeParticipantId(participantId);
        await client.removeParticipant(target, participant);
        return { ok: true, groupId: target, participantId: participant };
    }
    async replyGroupMessage(id, groupId, messageId, text) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const clean = String(text || '').trim();
        if (!clean)
            throw new common_1.BadRequestException('A resposta está vazia.');
        const result = await client.sendText(target, clean, { quotedMsg: String(messageId || '').trim() });
        await this.storeOutbound(id, target, clean, 'text', result);
        return { ok: true, groupId: target, quotedMessageId: messageId, result };
    }
    async reactToGroupMessage(id, messageId, reaction) {
        const client = this.requireClient(id);
        const target = String(messageId || '').trim();
        if (!target)
            throw new common_1.BadRequestException('messageId não informado.');
        return { ok: true, result: await client.sendReactionToMessage(target, reaction) };
    }
    async deleteGroupMessage(id, groupId, messageId) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const msgId = String(messageId || '').trim();
        if (!msgId)
            throw new common_1.BadRequestException('messageId não informado.');
        const result = await client.deleteMessage(target, msgId);
        return { ok: true, groupId: target, messageId: msgId, result };
    }
    async listGroupMembershipRequests(id, groupId) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const requests = await client.getGroupMembershipRequests(target);
        return Array.isArray(requests) ? requests : [];
    }
    async approveGroupMembershipRequest(id, groupId, participantId) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const participant = this.normalizeParticipantId(participantId);
        const result = await client.approveGroupMembershipRequest(target, participant);
        return { ok: true, groupId: target, participantId: participant, result };
    }
    async rejectGroupMembershipRequest(id, groupId, participantId) {
        const client = this.requireClient(id);
        const target = this.normalizeGroupId(groupId);
        const participant = this.normalizeParticipantId(participantId);
        const result = await client.rejectGroupMembershipRequest(target, participant);
        return { ok: true, groupId: target, participantId: participant, result };
    }
    async listChannels(id) {
        const client = this.requireClient(id);
        const chats = await client.listChats({ onlyNewsletter: true });
        return Array.isArray(chats) ? chats : [];
    }
    async sendText(id, target, text) {
        const cleanText = String(text || '').trim();
        if (!cleanText)
            throw new common_1.BadRequestException('A mensagem está vazia.');
        const chatId = this.normalizeChatId(target);
        const client = this.requireClient(id);
        const result = await client.sendText(chatId, cleanText);
        await this.storeOutbound(id, chatId, cleanText, 'text', result);
        return { ok: true, chatId, result };
    }
    async sendMedia(id, target, media, filename, caption) {
        if (!media)
            throw new common_1.BadRequestException('Informe a mídia em URL, caminho ou base64.');
        const chatId = this.normalizeChatId(target);
        const client = this.requireClient(id);
        const result = await client.sendFile(chatId, media, filename || 'arquivo', caption || '');
        await this.storeOutbound(id, chatId, caption || null, 'media', result);
        return { ok: true, chatId, result };
    }
    async publishChannel(id, channelId, text) {
        const target = String(channelId || '').trim();
        if (!target.includes('@newsletter'))
            throw new common_1.BadRequestException('Informe o ID do canal no formato ...@newsletter.');
        return this.sendText(id, target, text);
    }
    async publishStatus(id, data) {
        const client = this.requireClient(id);
        if (data.media) {
            if (/^data:video\//i.test(data.media) || /\.mp4(?:$|\?)/i.test(data.media)) {
                await client.sendVideoStatus(data.media, { caption: data.caption || '' });
            }
            else {
                await client.sendImageStatus(data.media, { caption: data.caption || '' });
            }
        }
        else if (data.text?.trim()) {
            await client.sendTextStatus(data.text.trim(), {});
        }
        else {
            throw new common_1.BadRequestException('Informe texto ou mídia para o status.');
        }
        return { ok: true };
    }
    async listMessages(id, limit = 50) {
        await this.getInstance(id);
        return this.messages.find({
            where: { instanceId: id },
            order: { createdAt: 'DESC' },
            take: Math.min(200, Math.max(1, limit)),
        });
    }
    async saveContact(id, data) {
        await this.getInstance(id);
        const phoneNumber = this.onlyDigits(String(data.phoneNumber || ''));
        const name = String(data.name || '').trim().slice(0, 160);
        if (!phoneNumber || !name)
            throw new common_1.BadRequestException('Nome e telefone são obrigatórios.');
        const waId = `${phoneNumber}@c.us`;
        let contact = await this.savedContacts.findOne({ where: { instanceId: id, waId } });
        if (!contact)
            contact = this.savedContacts.create({ instanceId: id, waId, phoneNumber, name, notes: null, metadata: null });
        contact.name = name;
        contact.notes = String(data.notes || '').trim() || null;
        return this.savedContacts.save(contact);
    }
    async listSavedContacts(id) {
        await this.getInstance(id);
        return this.savedContacts.find({ where: { instanceId: id }, order: { name: 'ASC' } });
    }
    async listKeys(instanceId) {
        await this.getInstance(instanceId);
        return this.keys.find({
            where: { instanceId },
            select: {
                id: true,
                instanceId: true,
                name: true,
                keyPrefix: true,
                scopes: true,
                active: true,
                createdById: true,
                lastUsedAt: true,
                expiresAt: true,
                createdAt: true,
                updatedAt: true,
            },
            order: { createdAt: 'DESC' },
        });
    }
    async createKey(instanceId, createdById, data) {
        const instance = await this.getInstance(instanceId);
        const name = String(data.name || '').trim().slice(0, 100);
        if (!name)
            throw new common_1.BadRequestException('Dê um nome para a chave.');
        const requested = (0, whatsapp_scopes_1.sanitizeWhatsAppScopes)(data.scopes);
        const scopes = requested.filter((scope) => instance.allowedScopes.includes(scope));
        if (!scopes.length)
            throw new common_1.BadRequestException('Selecione pelo menos uma permissão liberada para este número.');
        const rawKey = this.newKey();
        const key = await this.keys.save(this.keys.create({
            instanceId,
            name,
            keyPrefix: rawKey.slice(0, 24),
            keyHash: this.hash(rawKey),
            scopes,
            active: true,
            createdById,
            lastUsedAt: null,
            expiresAt: null,
        }));
        return {
            key: this.publicKey(key),
            apiKey: rawKey,
            warning: 'Copie agora. A chave completa não será exibida novamente.',
        };
    }
    async updateKey(keyId, data) {
        const key = await this.keys.findOne({ where: { id: keyId } });
        if (!key)
            throw new common_1.NotFoundException('Chave do WhatsApp não encontrada.');
        const instance = await this.getInstance(key.instanceId);
        if (typeof data.name === 'string' && data.name.trim())
            key.name = data.name.trim().slice(0, 100);
        if (typeof data.active === 'boolean')
            key.active = data.active;
        if (Array.isArray(data.scopes)) {
            key.scopes = (0, whatsapp_scopes_1.sanitizeWhatsAppScopes)(data.scopes).filter((scope) => instance.allowedScopes.includes(scope));
        }
        return this.publicKey(await this.keys.save(key));
    }
    async rotateKey(keyId) {
        const key = await this.keys.findOne({ where: { id: keyId } });
        if (!key)
            throw new common_1.NotFoundException('Chave do WhatsApp não encontrada.');
        const rawKey = this.newKey();
        key.keyPrefix = rawKey.slice(0, 24);
        key.keyHash = this.hash(rawKey);
        key.active = true;
        await this.keys.save(key);
        return { apiKey: rawKey, warning: 'A chave anterior foi revogada. Copie a nova chave agora.' };
    }
    requireClient(id) {
        const client = this.clients.get(id);
        if (!client)
            throw new common_1.BadRequestException('Este número não está conectado ao WhatsApp.');
        return client;
    }
    async decorateInstance(instance) {
        const runtime = this.states.get(instance.id);
        const [keyCount, messageCount] = await Promise.all([
            this.keys.count({ where: { instanceId: instance.id, active: true } }),
            this.messages.count({ where: { instanceId: instance.id } }),
        ]);
        return {
            ...instance,
            connected: this.clients.has(instance.id),
            qrCode: runtime?.qrCode || null,
            runtimeDetail: runtime?.detail || null,
            runtimeUpdatedAt: runtime?.updatedAt || null,
            keyCount,
            messageCount,
            capabilities: {
                messages: true,
                contacts: true,
                groups: true,
                groupHistory: true,
                groupMedia: true,
                groupModeration: true,
                channels: 'experimental',
                status: true,
                multiSession: true,
                mcp: true,
                concierge: true,
                otp: true,
            },
        };
    }
    setRuntime(id, value) {
        this.states.set(id, { ...value, updatedAt: new Date().toISOString() });
    }
    async setStatus(instance, status, error, connected = false) {
        instance.status = status;
        instance.lastError = error;
        instance.lastSeenAt = new Date();
        if (connected)
            instance.lastConnectedAt = new Date();
        await this.instances.save(instance);
    }
    async setStatusById(id, status, error, connected = false) {
        const instance = await this.instances.findOne({ where: { id } });
        if (instance)
            await this.setStatus(instance, status, error, connected);
    }
    async notifyUnexpectedDisconnect(instance, detail) {
        if (this.expectedDisconnects.has(instance.id))
            return;
        await this.alerts.send({
            severity: 'CRITICAL',
            title: 'WhatsApp desconectado',
            instanceName: instance.name,
            instanceId: instance.id,
            error: detail,
            context: { primarySupport: instance.isPrimarySupport, phoneNumber: instance.phoneNumber },
        });
    }
    async capturePhoneNumber(instance, client) {
        if (instance.phoneNumber)
            return;
        try {
            const host = await client.getHostDevice?.();
            const value = host?.wid?.user || host?.id?.user || host?.wid?._serialized || '';
            const digits = this.onlyDigits(String(value));
            if (digits) {
                instance.phoneNumber = digits;
                await this.instances.save(instance);
            }
        }
        catch {
        }
    }
    async storeInbound(instanceId, message) {
        try {
            await this.messages.save(this.messages.create({
                instanceId,
                providerMessageId: this.serializeWid(message?.id?._serialized || message?.id).slice(0, 100) || null,
                chatId: (this.serializeWid(message?.from || message?.chatId) || 'unknown').slice(0, 120),
                senderId: this.serializeWid(message?.sender?.id || message?.author || message?.from).slice(0, 120) || null,
                direction: whatsapp_message_entity_1.WhatsAppMessageDirection.INBOUND,
                type: String(message?.type || 'message').slice(0, 40),
                body: typeof message?.body === 'string' ? message.body : typeof message?.caption === 'string' ? message.caption : null,
                metadata: {
                    isGroupMsg: Boolean(message?.isGroupMsg),
                    isMedia: Boolean(message?.isMedia),
                    fromMe: Boolean(message?.fromMe),
                    isNotification: Boolean(message?.isNotification),
                    broadcast: Boolean(message?.broadcast),
                    mimetype: message?.mimetype || message?.mimeType || null,
                    caption: message?.caption || null,
                },
                providerTimestamp: message?.timestamp ? new Date(Number(message.timestamp) * 1000) : null,
            }));
        }
        catch (error) {
            this.logger.warn(`Não foi possível persistir mensagem recebida: ${this.errorMessage(error)}`);
        }
    }
    async storeOutbound(instanceId, chatId, body, type, result) {
        await this.messages.save(this.messages.create({
            instanceId,
            providerMessageId: this.serializeWid(result?.id?._serialized || result?.id).slice(0, 100) || null,
            chatId: chatId.slice(0, 120),
            senderId: null,
            direction: whatsapp_message_entity_1.WhatsAppMessageDirection.OUTBOUND,
            type,
            body,
            metadata: null,
            providerTimestamp: new Date(),
        }));
    }
    publicMessage(message) {
        return {
            id: this.serializeWid(message?.id?._serialized || message?.id),
            from: this.serializeWid(message?.from),
            to: this.serializeWid(message?.to),
            author: this.serializeWid(message?.author || message?.sender?.id),
            body: typeof message?.body === 'string' ? message.body : null,
            caption: typeof message?.caption === 'string' ? message.caption : null,
            type: String(message?.type || 'message'),
            timestamp: message?.timestamp || message?.t || null,
            fromMe: Boolean(message?.fromMe),
            isGroupMsg: Boolean(message?.isGroupMsg),
            isMedia: Boolean(message?.isMedia || message?.mimetype || message?.mimeType),
            mimetype: message?.mimetype || message?.mimeType || null,
            quotedMsgId: this.serializeWid(message?.quotedMsgId) || null,
            mentionedJidList: Array.isArray(message?.mentionedJidList) ? message.mentionedJidList.map((item) => this.serializeWid(item)) : [],
        };
    }
    normalizeGroupId(groupId) {
        const value = String(groupId || '').trim();
        if (!value.endsWith('@g.us'))
            throw new common_1.BadRequestException('Informe um groupId válido terminado em @g.us.');
        return value;
    }
    normalizeParticipantId(participantId) {
        const value = String(participantId || '').trim();
        if (!value)
            throw new common_1.BadRequestException('Participante não informado.');
        if (/@(?:c\.us|lid)$/.test(value))
            return value;
        const digits = this.onlyDigits(value);
        if (!digits)
            throw new common_1.BadRequestException('Participante inválido.');
        return `${digits}@c.us`;
    }
    normalizeChatId(target) {
        const value = String(target || '').trim();
        if (!value)
            throw new common_1.BadRequestException('Destino não informado.');
        if (/@(?:c\.us|g\.us|newsletter|lid)$/.test(value))
            return value;
        const digits = this.onlyDigits(value);
        if (!digits)
            throw new common_1.BadRequestException('Destino inválido.');
        return `${digits}@c.us`;
    }
    serializeWid(value) {
        if (!value)
            return '';
        if (typeof value === 'string')
            return value;
        if (typeof value?._serialized === 'string')
            return value._serialized;
        if (value?.user && value?.server)
            return `${value.user}@${value.server}`;
        const text = String(value);
        return text === '[object Object]' ? '' : text;
    }
    onlyDigits(value) {
        return value.replace(/\D+/g, '').slice(0, 32);
    }
    newKey() {
        return `pn_wa_${(0, crypto_1.randomBytes)(32).toString('hex')}`;
    }
    hash(value) {
        return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
    }
    publicKey(key) {
        const { keyHash: _hidden, ...safe } = key;
        return safe;
    }
    errorMessage(error) {
        return error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
    }
};
exports.WhatsAppService = WhatsAppService;
exports.WhatsAppService = WhatsAppService = WhatsAppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(whatsapp_instance_entity_1.WhatsAppInstance)),
    __param(1, (0, typeorm_1.InjectRepository)(whatsapp_api_key_entity_1.WhatsAppApiKey)),
    __param(2, (0, typeorm_1.InjectRepository)(whatsapp_message_entity_1.WhatsAppMessage)),
    __param(3, (0, typeorm_1.InjectRepository)(whatsapp_contact_entity_1.WhatsAppSavedContact)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        whatsapp_concierge_service_1.WhatsAppConciergeService,
        whatsapp_alert_service_1.WhatsAppAlertService])
], WhatsAppService);
//# sourceMappingURL=whatsapp.service.js.map