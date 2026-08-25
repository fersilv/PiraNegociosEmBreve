import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { join } from 'path';
import { Repository } from 'typeorm';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppSavedContact } from './entities/whatsapp-contact.entity';
import {
  WhatsAppConnectionStatus,
  WhatsAppInstance,
} from './entities/whatsapp-instance.entity';
import {
  WhatsAppMessage,
  WhatsAppMessageDirection,
} from './entities/whatsapp-message.entity';
import { sanitizeWhatsAppScopes } from './whatsapp.scopes';

type RuntimeState = {
  qrCode: string | null;
  detail: string | null;
  updatedAt: string;
};

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly clients = new Map<string, any>();
  private readonly states = new Map<string, RuntimeState>();
  private readonly connecting = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(WhatsAppInstance) private readonly instances: Repository<WhatsAppInstance>,
    @InjectRepository(WhatsAppApiKey) private readonly keys: Repository<WhatsAppApiKey>,
    @InjectRepository(WhatsAppMessage) private readonly messages: Repository<WhatsAppMessage>,
    @InjectRepository(WhatsAppSavedContact) private readonly savedContacts: Repository<WhatsAppSavedContact>,
  ) {}

  async onModuleInit() {
    const recoverable = await this.instances.find({ where: { active: true } });
    for (const instance of recoverable) {
      if (!instance.lastConnectedAt) continue;
      void this.connect(instance.id).catch((error) =>
        this.logger.warn(
          `Não foi possível restaurar automaticamente a sessão ${instance.id}: ${this.errorMessage(error)}`,
        ),
      );
    }
  }

  async onModuleDestroy() {
    await Promise.allSettled(
      [...this.clients.values()].map((client) => Promise.resolve(client.close?.())),
    );
  }

  async listInstances() {
    const rows = await this.instances.find({ order: { createdAt: 'DESC' } });
    return Promise.all(rows.map((instance) => this.decorateInstance(instance)));
  }

  async getInstance(id: string) {
    const instance = await this.instances.findOne({ where: { id } });
    if (!instance) throw new NotFoundException('Número do WhatsApp não encontrado.');
    return instance;
  }

  async createInstance(createdById: string, data: Record<string, unknown>) {
    const name = String(data.name || '').trim().slice(0, 100);
    if (!name) throw new BadRequestException('Informe um nome para identificar este número.');
    const purpose = String(data.purpose || '').trim().slice(0, 180) || null;
    const phoneNumber = this.onlyDigits(String(data.phoneNumber || '')) || null;
    const allowedScopes = sanitizeWhatsAppScopes(data.allowedScopes);
    const instance = await this.instances.save(
      this.instances.create({
        name,
        purpose,
        phoneNumber,
        sessionName: `pn-${randomBytes(12).toString('hex')}`,
        provider: 'wppconnect',
        status: WhatsAppConnectionStatus.DISCONNECTED,
        allowedScopes,
        active: true,
        lastError: null,
        lastConnectedAt: null,
        lastSeenAt: null,
        createdById,
      }),
    );
    return this.decorateInstance(instance);
  }

  async updateInstance(id: string, data: Record<string, unknown>) {
    const instance = await this.getInstance(id);
    if (typeof data.name === 'string' && data.name.trim()) instance.name = data.name.trim().slice(0, 100);
    if (typeof data.purpose === 'string') instance.purpose = data.purpose.trim().slice(0, 180) || null;
    if (typeof data.phoneNumber === 'string') instance.phoneNumber = this.onlyDigits(data.phoneNumber) || null;
    if (typeof data.active === 'boolean') instance.active = data.active;
    if (Array.isArray(data.allowedScopes)) instance.allowedScopes = sanitizeWhatsAppScopes(data.allowedScopes);
    await this.instances.save(instance);
    return this.decorateInstance(instance);
  }

  async removeInstance(id: string) {
    await this.disconnect(id, false).catch(() => undefined);
    const instance = await this.getInstance(id);
    await this.instances.remove(instance);
    this.states.delete(id);
    return { ok: true };
  }

  async connect(id: string) {
    const instance = await this.getInstance(id);
    if (!instance.active) throw new BadRequestException('Ative o número antes de conectar.');
    if (this.clients.has(id) || this.connecting.has(id)) return this.status(id);

    await this.setStatus(instance, WhatsAppConnectionStatus.CONNECTING, null);
    this.setRuntime(id, { qrCode: null, detail: 'Abrindo sessão do WhatsApp Web...' });

    const task = this.connectInternal(instance)
      .catch((error) => {
        this.logger.error(
          `Falha ao abrir sessão WhatsApp ${id}: ${this.errorMessage(error)}`,
        );
      })
      .finally(() => {
        this.connecting.delete(id);
      });
    this.connecting.set(id, task);

    // O navegador continua abrindo no servidor. A API responde agora para que
    // o painel consiga consultar /status e mostrar o QR Code assim que chegar.
    return this.status(id);
  }

  private async connectInternal(instance: WhatsAppInstance) {
    const id = instance.id;
    if (this.clients.has(id)) return;

    const sessionDir = process.env.WHATSAPP_SESSION_DIR || join(process.cwd(), 'whatsapp-sessions');
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
        catchQR: (base64Qr: string) => {
          const qrCode = base64Qr.startsWith('data:')
            ? base64Qr
            : `data:image/png;base64,${base64Qr}`;
          this.setRuntime(id, { qrCode, detail: 'Leia o QR Code no WhatsApp do aparelho.' });
          void this.setStatusById(id, WhatsAppConnectionStatus.QR_REQUIRED, null);
        },
        statusFind: (statusSession: string) => {
          const status = String(statusSession || '').toLowerCase();
          if (status.includes('logged') && !status.includes('notlogged')) {
            this.setRuntime(id, { qrCode: null, detail: 'Sessão autenticada.' });
            void this.setStatusById(id, WhatsAppConnectionStatus.CONNECTED, null, true);
          } else if (status.includes('notlogged')) {
            void this.setStatusById(id, WhatsAppConnectionStatus.QR_REQUIRED, null);
          } else if (
            status.includes('disconnect') ||
            status.includes('browserclose') ||
            status.includes('serverclose') ||
            status.includes('delete')
          ) {
            this.clients.delete(id);
            void this.setStatusById(id, WhatsAppConnectionStatus.DISCONNECTED, null);
          }
        },
      } as any);

      this.clients.set(id, client);
      this.setRuntime(id, { qrCode: null, detail: 'Conectado e recebendo eventos.' });
      await this.setStatusById(id, WhatsAppConnectionStatus.CONNECTED, null, true);
      await this.capturePhoneNumber(instance, client);
      client.onMessage?.((message: any) => void this.storeInbound(instance.id, message));
      client.onStateChange?.((state: unknown) => {
        const value = String(state || '');
        if (/DISCONNECTED|UNPAIRED|UNLAUNCHED|CONFLICT/i.test(value)) {
          this.clients.delete(id);
          void this.setStatusById(id, WhatsAppConnectionStatus.DISCONNECTED, value);
        }
      });
    } catch (error) {
      const detail = this.errorMessage(error);
      this.logger.error(`Falha ao conectar WhatsApp ${id}: ${detail}`);
      this.setRuntime(id, { qrCode: null, detail });
      await this.setStatusById(id, WhatsAppConnectionStatus.ERROR, detail);
    }
  }

  async disconnect(id: string, logout = false) {
    const instance = await this.getInstance(id);
    const client = this.clients.get(id);
    if (client) {
      try {
        if (logout && typeof client.logout === 'function') await client.logout();
        else if (typeof client.close === 'function') await client.close();
      } finally {
        this.clients.delete(id);
      }
    }
    this.setRuntime(id, { qrCode: null, detail: logout ? 'Aparelho desvinculado.' : 'Sessão parada.' });
    await this.setStatus(instance, WhatsAppConnectionStatus.DISCONNECTED, null);
    return this.status(id);
  }

  async status(id: string) {
    const instance = await this.getInstance(id);
    return this.decorateInstance(instance);
  }

  async listContacts(id: string) {
    const client = this.requireClient(id);
    const contacts = await client.getAllContacts();
    return Array.isArray(contacts) ? contacts : [];
  }

  async listGroups(id: string) {
    const client = this.requireClient(id);
    const groups = await client.getAllGroups();
    return Array.isArray(groups) ? groups : [];
  }

  async listChannels(id: string) {
    const client = this.requireClient(id);
    const chats = await client.listChats();
    if (!Array.isArray(chats)) return [];
    return chats.filter((chat: any) => {
      const serialized = String(chat?.id?._serialized || chat?.id || '');
      return serialized.endsWith('@newsletter');
    });
  }

  async sendText(id: string, target: string, text: string) {
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new BadRequestException('A mensagem está vazia.');
    const chatId = this.normalizeChatId(target);
    const client = this.requireClient(id);
    const result = await client.sendText(chatId, cleanText);
    await this.storeOutbound(id, chatId, cleanText, 'text', result);
    return { ok: true, chatId, result };
  }

  async sendMedia(id: string, target: string, media: string, filename?: string, caption?: string) {
    if (!media) throw new BadRequestException('Informe a mídia em URL, caminho ou base64.');
    const chatId = this.normalizeChatId(target);
    const client = this.requireClient(id);
    const result = await client.sendFile(chatId, media, filename || 'arquivo', caption || '');
    await this.storeOutbound(id, chatId, caption || null, 'media', result);
    return { ok: true, chatId, result };
  }

  async publishChannel(id: string, channelId: string, text: string) {
    const target = String(channelId || '').trim();
    if (!target.includes('@newsletter')) throw new BadRequestException('Informe o ID do canal no formato ...@newsletter.');
    return this.sendText(id, target, text);
  }

  async publishStatus(id: string, data: { text?: string; media?: string; caption?: string }) {
    const client = this.requireClient(id);
    if (data.media) {
      if (/^data:video\//i.test(data.media) || /\.mp4(?:$|\?)/i.test(data.media)) {
        await client.sendVideoStatus(data.media, { caption: data.caption || '' });
      } else {
        await client.sendImageStatus(data.media, { caption: data.caption || '' });
      }
    } else if (data.text?.trim()) {
      await client.sendTextStatus(data.text.trim(), {});
    } else {
      throw new BadRequestException('Informe texto ou mídia para o status.');
    }
    return { ok: true };
  }

  async listMessages(id: string, limit = 50) {
    await this.getInstance(id);
    return this.messages.find({
      where: { instanceId: id },
      order: { createdAt: 'DESC' },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  async saveContact(id: string, data: { phoneNumber?: string; name?: string; notes?: string }) {
    await this.getInstance(id);
    const phoneNumber = this.onlyDigits(String(data.phoneNumber || ''));
    const name = String(data.name || '').trim().slice(0, 160);
    if (!phoneNumber || !name) throw new BadRequestException('Nome e telefone são obrigatórios.');
    const waId = `${phoneNumber}@c.us`;
    let contact = await this.savedContacts.findOne({ where: { instanceId: id, waId } });
    if (!contact) contact = this.savedContacts.create({ instanceId: id, waId, phoneNumber, name, notes: null, metadata: null });
    contact.name = name;
    contact.notes = String(data.notes || '').trim() || null;
    return this.savedContacts.save(contact);
  }

  async listSavedContacts(id: string) {
    await this.getInstance(id);
    return this.savedContacts.find({ where: { instanceId: id }, order: { name: 'ASC' } });
  }

  async listKeys(instanceId: string) {
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

  async createKey(instanceId: string, createdById: string, data: Record<string, unknown>) {
    const instance = await this.getInstance(instanceId);
    const name = String(data.name || '').trim().slice(0, 100);
    if (!name) throw new BadRequestException('Dê um nome para a chave.');
    const requested = sanitizeWhatsAppScopes(data.scopes);
    const scopes = requested.filter((scope) => instance.allowedScopes.includes(scope));
    if (!scopes.length) throw new BadRequestException('Selecione pelo menos uma permissão liberada para este número.');
    const rawKey = this.newKey();
    const key = await this.keys.save(
      this.keys.create({
        instanceId,
        name,
        keyPrefix: rawKey.slice(0, 24),
        keyHash: this.hash(rawKey),
        scopes,
        active: true,
        createdById,
        lastUsedAt: null,
        expiresAt: null,
      }),
    );
    return {
      key: this.publicKey(key),
      apiKey: rawKey,
      warning: 'Copie agora. A chave completa não será exibida novamente.',
    };
  }

  async updateKey(keyId: string, data: Record<string, unknown>) {
    const key = await this.keys.findOne({ where: { id: keyId } });
    if (!key) throw new NotFoundException('Chave do WhatsApp não encontrada.');
    const instance = await this.getInstance(key.instanceId);
    if (typeof data.name === 'string' && data.name.trim()) key.name = data.name.trim().slice(0, 100);
    if (typeof data.active === 'boolean') key.active = data.active;
    if (Array.isArray(data.scopes)) {
      key.scopes = sanitizeWhatsAppScopes(data.scopes).filter((scope) => instance.allowedScopes.includes(scope));
    }
    return this.publicKey(await this.keys.save(key));
  }

  async rotateKey(keyId: string) {
    const key = await this.keys.findOne({ where: { id: keyId } });
    if (!key) throw new NotFoundException('Chave do WhatsApp não encontrada.');
    const rawKey = this.newKey();
    key.keyPrefix = rawKey.slice(0, 24);
    key.keyHash = this.hash(rawKey);
    key.active = true;
    await this.keys.save(key);
    return { apiKey: rawKey, warning: 'A chave anterior foi revogada. Copie a nova chave agora.' };
  }

  private requireClient(id: string) {
    const client = this.clients.get(id);
    if (!client) throw new BadRequestException('Este número não está conectado ao WhatsApp.');
    return client;
  }

  private async decorateInstance(instance: WhatsAppInstance) {
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
        channels: 'experimental',
        status: true,
        multiSession: true,
        mcp: true,
      },
    };
  }

  private setRuntime(id: string, value: Pick<RuntimeState, 'qrCode' | 'detail'>) {
    this.states.set(id, { ...value, updatedAt: new Date().toISOString() });
  }

  private async setStatus(instance: WhatsAppInstance, status: WhatsAppConnectionStatus, error: string | null, connected = false) {
    instance.status = status;
    instance.lastError = error;
    instance.lastSeenAt = new Date();
    if (connected) instance.lastConnectedAt = new Date();
    await this.instances.save(instance);
  }

  private async setStatusById(id: string, status: WhatsAppConnectionStatus, error: string | null, connected = false) {
    const instance = await this.instances.findOne({ where: { id } });
    if (instance) await this.setStatus(instance, status, error, connected);
  }

  private async capturePhoneNumber(instance: WhatsAppInstance, client: any) {
    if (instance.phoneNumber) return;
    try {
      const host = await client.getHostDevice?.();
      const value = host?.wid?.user || host?.id?.user || host?.wid?._serialized || '';
      const digits = this.onlyDigits(String(value));
      if (digits) {
        instance.phoneNumber = digits;
        await this.instances.save(instance);
      }
    } catch {
      // O telefone é apenas enriquecimento; a sessão conectada continua válida.
    }
  }

  private async storeInbound(instanceId: string, message: any) {
    try {
      await this.messages.save(
        this.messages.create({
          instanceId,
          providerMessageId: String(message?.id?._serialized || message?.id || '').slice(0, 100) || null,
          chatId: String(message?.from || message?.chatId || 'unknown').slice(0, 120),
          senderId: String(message?.sender?.id || message?.author || message?.from || '').slice(0, 120) || null,
          direction: WhatsAppMessageDirection.INBOUND,
          type: String(message?.type || 'message').slice(0, 40),
          body: typeof message?.body === 'string' ? message.body : null,
          metadata: {
            isGroupMsg: Boolean(message?.isGroupMsg),
            isMedia: Boolean(message?.isMedia),
            fromMe: Boolean(message?.fromMe),
          },
          providerTimestamp: message?.timestamp ? new Date(Number(message.timestamp) * 1000) : null,
        }),
      );
    } catch (error) {
      this.logger.warn(`Não foi possível persistir mensagem recebida: ${this.errorMessage(error)}`);
    }
  }

  private async storeOutbound(instanceId: string, chatId: string, body: string | null, type: string, result: any) {
    await this.messages.save(
      this.messages.create({
        instanceId,
        providerMessageId: String(result?.id?._serialized || result?.id || '').slice(0, 100) || null,
        chatId: chatId.slice(0, 120),
        senderId: null,
        direction: WhatsAppMessageDirection.OUTBOUND,
        type,
        body,
        metadata: null,
        providerTimestamp: new Date(),
      }),
    );
  }

  private normalizeChatId(target: string) {
    const value = String(target || '').trim();
    if (!value) throw new BadRequestException('Destino não informado.');
    if (/@(?:c\.us|g\.us|newsletter)$/.test(value)) return value;
    const digits = this.onlyDigits(value);
    if (!digits) throw new BadRequestException('Destino inválido.');
    return `${digits}@c.us`;
  }

  private onlyDigits(value: string) {
    return value.replace(/\D+/g, '').slice(0, 32);
  }

  private newKey() {
    return `pn_wa_${randomBytes(32).toString('hex')}`;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private publicKey(key: WhatsAppApiKey) {
    const { keyHash: _hidden, ...safe } = key;
    return safe;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
  }
}
