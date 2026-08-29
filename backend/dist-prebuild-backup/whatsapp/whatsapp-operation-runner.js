"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeWppOperation = executeWppOperation;
const common_1 = require("@nestjs/common");
const whatsapp_operations_catalog_1 = require("./whatsapp-operations.catalog");
const EVENT_BUFFER_LIMIT = 200;
const eventBuffers = new Map();
const eventSubscriptions = new Map();
async function executeWppOperation(whatsapp, instanceId, scope, args = []) {
    if (!Array.isArray(args) || args.length > 20) {
        throw new common_1.BadRequestException('arguments deve ser um array com no máximo 20 parâmetros.');
    }
    const client = whatsapp.clients?.get(instanceId);
    if (!client)
        throw new common_1.BadRequestException('Este número não está conectado ao WhatsApp.');
    if (scope === 'groups:reply') {
        const [groupIdRaw, messageIdRaw, textRaw] = args;
        const groupId = requireGroupId(groupIdRaw);
        const messageId = requireText(messageIdRaw, 'messageId');
        const text = requireText(textRaw, 'text');
        const value = await client.sendText(groupId, text, { quotedMsg: messageId });
        return { operation: 'replyGroup', scope, result: normalizeWppResult(value) };
    }
    if (scope === 'groups:reaction') {
        const [messageIdRaw, reactionRaw] = args;
        const messageId = requireText(messageIdRaw, 'messageId');
        const reaction = reactionRaw === false ? false : requireText(reactionRaw, 'reaction');
        const value = await client.sendReactionToMessage(messageId, reaction);
        return { operation: 'reactGroupMessage', scope, result: normalizeWppResult(value) };
    }
    if (scope === 'groups:message:delete') {
        const [groupIdRaw, messageIdRaw, onlyLocalRaw] = args;
        const groupId = requireGroupId(groupIdRaw);
        const messageId = requireText(messageIdRaw, 'messageId');
        const onlyLocal = typeof onlyLocalRaw === 'boolean' ? onlyLocalRaw : false;
        const value = await client.deleteMessage(groupId, messageId, onlyLocal, true);
        return { operation: 'deleteGroupMessage', scope, result: normalizeWppResult(value) };
    }
    if (scope === 'channels:search') {
        const [queryRaw, limitRaw] = args;
        const query = requireText(queryRaw, 'query');
        const limit = Math.min(50, Math.max(1, Number(limitRaw || 20)));
        if (!client.page?.evaluate) {
            throw new common_1.BadRequestException('A sessão atual não expõe a página do WhatsApp para pesquisar canais.');
        }
        try {
            const value = await client.page.evaluate(async ({ query, limit }) => {
                const wpp = globalThis.WPP;
                if (!wpp?.newsletter?.search) {
                    throw new Error('WPP.newsletter.search não está disponível nesta versão do WhatsApp Web.');
                }
                return wpp.newsletter.search(query, { limit });
            }, { query, limit });
            return {
                operation: 'searchChannels',
                scope: 'channels:search',
                result: normalizeWppResult(value),
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new common_1.BadRequestException(`Busca de canais falhou: ${message.slice(0, 2000)}`);
        }
    }
    if (scope === 'channels:publish:text') {
        const [newsletterIdRaw, textRaw] = args;
        const newsletterId = requireNewsletterId(newsletterIdRaw);
        const text = requireText(textRaw, 'text');
        if (text.length > 4096) {
            throw new common_1.BadRequestException('text deve ter no máximo 4096 caracteres para este teste de canal.');
        }
        if (!client.page?.evaluate) {
            throw new common_1.BadRequestException('A sessão atual não expõe a página do WhatsApp para publicar no canal.');
        }
        try {
            const value = await client.page.evaluate(async ({ newsletterId, text }) => {
                const wpp = globalThis.WPP;
                const wa = wpp?.whatsapp;
                const fn = wa?.functions;
                const chat = wa?.NewsletterStore?.get?.(newsletterId);
                if (!chat) {
                    throw new Error(`Newsletter ${newsletterId} não foi encontrada na NewsletterStore da sessão.`);
                }
                if (!wpp?.chat?.prepareRawMessage) {
                    throw new Error('WPP.chat.prepareRawMessage não está disponível nesta versão do WA-JS.');
                }
                if (!wa?.MsgModel || !fn?.sendNewsletterMessageJob || !fn?.msgDataFromMsgModel) {
                    throw new Error('O pipeline interno de newsletter do WA-JS não está disponível nesta sessão.');
                }
                const rawMessage = await wpp.chat.prepareRawMessage(chat, {
                    type: 'chat',
                    body: text,
                });
                const msg = new wa.MsgModel(rawMessage);
                if (fn.addNewsletterMsgsRecords) {
                    await fn.addNewsletterMsgsRecords([await fn.msgDataFromMsgModel(msg)]);
                }
                const resultNewsletter = await fn.sendNewsletterMessageJob({
                    type: 'text',
                    msgData: rawMessage,
                    msg,
                    newsletterJid: newsletterId,
                });
                chat.msgs?.add?.(msg);
                if (resultNewsletter?.success) {
                    if (resultNewsletter.ack?.t)
                        msg.t = resultNewsletter.ack.t;
                    if (resultNewsletter.serverId != null)
                        msg.serverId = resultNewsletter.serverId;
                }
                const sentAck = wa?.enums?.ACK?.SENT;
                if (sentAck != null && typeof msg.updateAck === 'function') {
                    msg.updateAck(sentAck, true);
                }
                if (fn.updateNewsletterMsgRecord) {
                    await fn.updateNewsletterMsgRecord(msg);
                }
                return {
                    success: Boolean(resultNewsletter?.success),
                    id: msg?.id?.toString?.() || rawMessage?.id?.toString?.() || null,
                    newsletterId,
                    ack: msg?.ack ?? null,
                    serverId: msg?.serverId ?? resultNewsletter?.serverId ?? null,
                    providerResult: resultNewsletter || null,
                };
            }, { newsletterId, text });
            return {
                operation: 'publishChannelText',
                scope: 'channels:publish:text',
                mode: 'newsletter-direct',
                result: normalizeWppResult(value),
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new common_1.BadRequestException(`Publicação de texto no canal falhou: ${message.slice(0, 2000)}`);
        }
    }
    const capability = whatsapp_operations_catalog_1.WPP_OPERATION_CAPABILITIES.find((item) => item.scope === scope);
    if (!capability)
        throw new common_1.BadRequestException('Operação WPPConnect não autorizada pelo catálogo.');
    if (capability.event) {
        const limit = Math.min(EVENT_BUFFER_LIMIT, Math.max(1, Number(args[0] || 50)));
        await ensureEventSubscription(client, instanceId, capability.method);
        const key = eventKey(instanceId, capability.method);
        const rows = eventBuffers.get(key) || [];
        return {
            operation: capability.method,
            scope: capability.scope,
            mode: 'event-monitor',
            subscribed: true,
            retainedEvents: rows.length,
            result: rows.slice(-limit),
            note: 'O listener permanece ativo neste processo do backend enquanto a sessão atual estiver conectada.',
        };
    }
    const method = client[capability.method];
    if (typeof method !== 'function') {
        throw new common_1.BadRequestException(`A versão atual do WPPConnect não disponibiliza ${capability.method}.`);
    }
    try {
        const value = await method.apply(client, args);
        return {
            operation: capability.method,
            scope: capability.scope,
            signature: capability.signature,
            result: normalizeWppResult(value),
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new common_1.BadRequestException(`${capability.method} falhou: ${message.slice(0, 2000)}`);
    }
}
async function ensureEventSubscription(client, instanceId, event) {
    const key = eventKey(instanceId, event);
    const current = eventSubscriptions.get(key);
    if (current?.client === client)
        return;
    try {
        current?.disposable?.dispose?.();
    }
    catch {
    }
    eventSubscriptions.delete(key);
    const method = client?.[event];
    if (typeof method !== 'function') {
        throw new common_1.BadRequestException(`A versão atual do WPPConnect não disponibiliza o listener ${event}.`);
    }
    try {
        const disposable = await Promise.resolve(method.call(client, (...callbackArgs) => {
            const buffer = eventBuffers.get(key) || [];
            buffer.push({
                at: new Date().toISOString(),
                event,
                args: callbackArgs.map((value) => normalizeWppResult(value)),
            });
            if (buffer.length > EVENT_BUFFER_LIMIT) {
                buffer.splice(0, buffer.length - EVENT_BUFFER_LIMIT);
            }
            eventBuffers.set(key, buffer);
        }));
        eventSubscriptions.set(key, {
            client,
            disposable: disposable && typeof disposable === 'object'
                ? disposable
                : null,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new common_1.BadRequestException(`Não foi possível ativar ${event}: ${message.slice(0, 2000)}`);
    }
}
function eventKey(instanceId, event) {
    return `${instanceId}:${event}`;
}
function requireText(value, field) {
    const text = String(value ?? '').trim();
    if (!text)
        throw new common_1.BadRequestException(`${field} é obrigatório.`);
    return text;
}
function requireGroupId(value) {
    const groupId = requireText(value, 'groupId');
    if (!groupId.endsWith('@g.us'))
        throw new common_1.BadRequestException('groupId deve terminar em @g.us.');
    return groupId;
}
function requireNewsletterId(value) {
    const newsletterId = requireText(value, 'newsletterId');
    if (!/^\d+@newsletter$/.test(newsletterId)) {
        throw new common_1.BadRequestException('newsletterId deve ter o formato numérico ...@newsletter.');
    }
    return newsletterId;
}
function normalizeWppResult(value, depth = 0, seen = new WeakSet()) {
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    if (typeof value === 'bigint')
        return value.toString();
    if (Buffer.isBuffer(value))
        return { type: 'buffer', base64: value.toString('base64') };
    if (value instanceof Date)
        return value.toISOString();
    if (depth > 6)
        return '[max-depth]';
    if (Array.isArray(value)) {
        return value.slice(0, 500).map((item) => normalizeWppResult(item, depth + 1, seen));
    }
    if (typeof value === 'object') {
        const object = value;
        if (seen.has(object))
            return '[circular]';
        seen.add(object);
        const safe = {};
        for (const [key, nested] of Object.entries(object).slice(0, 300)) {
            if (['page', 'waPage', 'session', 'browser', 'client'].includes(key))
                continue;
            if (typeof nested === 'function')
                continue;
            safe[key] = normalizeWppResult(nested, depth + 1, seen);
        }
        return safe;
    }
    return String(value);
}
//# sourceMappingURL=whatsapp-operation-runner.js.map