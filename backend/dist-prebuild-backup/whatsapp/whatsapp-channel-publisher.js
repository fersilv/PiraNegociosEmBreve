"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishChannelLink = publishChannelLink;
exports.publishChannelTextWithLink = publishChannelTextWithLink;
exports.publishChannelMedia = publishChannelMedia;
const common_1 = require("@nestjs/common");
const promises_1 = require("dns/promises");
const net_1 = require("net");
const MAX_MEDIA_BYTES = 64 * 1024 * 1024;
async function publishChannelLink(whatsapp, instanceId, newsletterIdRaw, urlRaw) {
    const newsletterId = requireNewsletterId(newsletterIdRaw);
    const url = requirePublicHttpUrl(urlRaw, 'url');
    return publishRichText(whatsapp, instanceId, newsletterId, url, true, 'publishChannelLink');
}
async function publishChannelTextWithLink(whatsapp, instanceId, newsletterIdRaw, textRaw, urlRaw) {
    const newsletterId = requireNewsletterId(newsletterIdRaw);
    const text = requireText(textRaw, 'text');
    const url = requirePublicHttpUrl(urlRaw, 'url');
    const body = `${text}\n${url}`;
    if (body.length > 4096)
        throw new common_1.BadRequestException('text + url deve ter no máximo 4096 caracteres.');
    return publishRichText(whatsapp, instanceId, newsletterId, body, true, 'publishChannelTextWithLink');
}
async function publishChannelMedia(whatsapp, instanceId, newsletterIdRaw, options) {
    const newsletterId = requireNewsletterId(newsletterIdRaw);
    const client = requireClient(whatsapp, instanceId);
    if (!client.page?.evaluate) {
        throw new common_1.BadRequestException('A sessão atual não expõe a página do WhatsApp para publicar mídia no canal.');
    }
    const type = options.type;
    const caption = options.caption == null ? undefined : String(options.caption).trim().slice(0, 4096);
    const filename = String(options.filename || defaultFilename(type)).trim().slice(0, 180);
    const mimetype = String(options.mimetype || defaultMime(type)).trim().slice(0, 120);
    const media = await normalizeMediaInput(options.media, mimetype);
    try {
        const value = await client.page.evaluate(async ({ newsletterId, media, type, caption, filename, mimetype, asVoice }) => {
            const wpp = globalThis.WPP;
            const wa = wpp?.whatsapp;
            const newsletter = wa?.NewsletterStore?.get?.(newsletterId);
            let stage = 'bootstrap';
            const errorDetails = (error) => ({
                name: String(error?.name || 'Error'),
                message: String(error?.message || error || 'Erro sem mensagem'),
                code: error?.code == null ? null : String(error.code),
                stack: typeof error?.stack === 'string' ? error.stack.slice(0, 1800) : null,
            });
            try {
                if (!newsletter) {
                    throw new Error(`Newsletter ${newsletterId} não foi encontrada na NewsletterStore da sessão.`);
                }
                if (!wpp?.chat?.prepareRawMessage || !wa?.OpaqueData?.createFromData || !wa?.MediaPrep?.prepRawMedia) {
                    throw new Error('O pipeline MediaPrep/OpaqueData do WA-JS não está disponível nesta sessão.');
                }
                stage = 'decode-media';
                const match = media.match(/^data:([^;,]+)?;base64,([\s\S]+)$/i);
                if (!match)
                    throw new Error('A mídia normalizada não chegou ao navegador como data URL Base64.');
                const mediaType = String(match[1] || mimetype || 'application/octet-stream');
                const binary = atob(match[2].replace(/\s+/g, ''));
                const bytes = new Uint8Array(binary.length);
                for (let index = 0; index < binary.length; index += 1)
                    bytes[index] = binary.charCodeAt(index);
                const file = new File([bytes], filename, { type: mediaType });
                stage = 'opaque-data';
                const opaqueData = await wa.OpaqueData.createFromData(file, mediaType);
                const rawMediaOptions = {};
                if (type === 'audio')
                    rawMediaOptions.isPtt = asVoice;
                if (type === 'document')
                    rawMediaOptions.asDocument = true;
                stage = 'media-prep';
                const mediaPrep = wa.MediaPrep.prepRawMedia(opaqueData, rawMediaOptions);
                const rawMessage = await wpp.chat.prepareRawMessage(newsletter, {
                    caption: caption || filename,
                    filename,
                    isCaptionByUser: caption !== undefined,
                }, {
                    type,
                    filename,
                    mimetype: mediaType,
                    ...(caption !== undefined ? { caption } : {}),
                    ...(type === 'audio' ? { isPtt: asVoice } : {}),
                    waitForAck: true,
                });
                stage = 'wait-for-prep';
                const preparedMedia = await mediaPrep.waitForPrep();
                const preparedType = String(preparedMedia?.type || rawMessage?.type || type);
                const collection = newsletter.msgs;
                const rawId = rawMessage?.id?.toString?.() || String(rawMessage?.id || '');
                let observedMessage = null;
                const observed = new Promise((resolve) => {
                    if (!collection?.on || !rawId) {
                        resolve(null);
                        return;
                    }
                    const handler = (msg) => {
                        const id = msg?.id?.toString?.() || String(msg?.id || '');
                        if (id !== rawId)
                            return;
                        observedMessage = msg;
                        collection.off?.('add', handler);
                        resolve(msg);
                    };
                    collection.on('add', handler);
                    setTimeout(() => {
                        collection.off?.('add', handler);
                        resolve(observedMessage);
                    }, 12_000);
                });
                stage = 'send-to-newsletter';
                const processedOptions = {
                    caption,
                    productMsgOptions: rawMessage,
                    addEvenWhilePreparing: false,
                    type: rawMessage?.type || preparedType,
                };
                const sendResult = mediaPrep.sendToChat.length === 1
                    ? await mediaPrep.sendToChat({ chat: newsletter, options: processedOptions })
                    : await mediaPrep.sendToChat(newsletter, processedOptions);
                stage = 'observe-message';
                const msg = await observed;
                const finalMessage = msg || collection?.get?.(rawMessage?.id) || null;
                const finalId = finalMessage?.id?.toString?.() || rawId || null;
                const ack = finalMessage?.ack ?? null;
                const serverId = finalMessage?.serverId ?? null;
                return {
                    success: true,
                    stage: 'done',
                    newsletterId,
                    type,
                    preparedType,
                    caption: caption ?? null,
                    filename,
                    mimetype: mediaType,
                    id: finalId,
                    ack,
                    serverId,
                    sendResult: sendResult ?? null,
                    diagnostics: {
                        newsletterIsNewsletter: Boolean(newsletter?.isNewsletter),
                        hasNewsletterMessages: Boolean(collection),
                        mediaPrepSendArity: Number(mediaPrep?.sendToChat?.length || 0),
                        observedMessage: Boolean(finalMessage),
                    },
                };
            }
            catch (error) {
                return {
                    success: false,
                    stage,
                    newsletterId,
                    type,
                    filename,
                    mimetype,
                    error: errorDetails(error),
                    diagnostics: {
                        newsletterFound: Boolean(newsletter),
                        newsletterIsNewsletter: Boolean(newsletter?.isNewsletter),
                        hasOpaqueData: Boolean(wa?.OpaqueData?.createFromData),
                        hasMediaPrep: Boolean(wa?.MediaPrep?.prepRawMedia),
                        hasPrepareRawMessage: Boolean(wpp?.chat?.prepareRawMessage),
                        hasNewsletterJob: Boolean(wa?.functions?.sendNewsletterMessageJob),
                    },
                };
            }
        }, {
            newsletterId,
            media,
            type,
            caption,
            filename,
            mimetype,
            asVoice: Boolean(options.asVoice),
        });
        return {
            operation: `publishChannel${type.charAt(0).toUpperCase()}${type.slice(1)}`,
            scope: `channels:publish:${type === 'document' ? 'file' : type}`,
            mode: 'newsletter-native-media-prep',
            ok: Boolean(value?.success),
            result: value,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            operation: `publishChannel${type.charAt(0).toUpperCase()}${type.slice(1)}`,
            scope: `channels:publish:${type === 'document' ? 'file' : type}`,
            mode: 'newsletter-native-media-prep',
            ok: false,
            result: {
                success: false,
                stage: 'server-wrapper',
                newsletterId,
                type,
                filename,
                mimetype,
                error: { message: message.slice(0, 2000) },
            },
        };
    }
}
async function publishRichText(whatsapp, instanceId, newsletterId, body, linkPreview, operation) {
    const client = requireClient(whatsapp, instanceId);
    if (!client.page?.evaluate) {
        throw new common_1.BadRequestException('A sessão atual não expõe a página do WhatsApp para publicar no canal.');
    }
    try {
        const value = await client.page.evaluate(async ({ newsletterId, body, linkPreview }) => {
            const wpp = globalThis.WPP;
            const wa = wpp?.whatsapp;
            const fn = wa?.functions;
            const chat = wa?.NewsletterStore?.get?.(newsletterId);
            if (!chat)
                throw new Error(`Newsletter ${newsletterId} não foi encontrada na NewsletterStore da sessão.`);
            if (!wpp?.chat?.prepareRawMessage || !wa?.MsgModel || !fn?.sendNewsletterMessageJob || !fn?.msgDataFromMsgModel) {
                throw new Error('O pipeline interno de newsletter do WA-JS não está disponível nesta sessão.');
            }
            let rawInput = { type: 'chat', body, subtype: null, urlText: null, urlNumber: null };
            if (linkPreview && wpp.chat.prepareLinkPreview) {
                rawInput = await wpp.chat.prepareLinkPreview(rawInput, { linkPreview: true });
            }
            const rawMessage = await wpp.chat.prepareRawMessage(chat, rawInput);
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
            if (sentAck != null && typeof msg.updateAck === 'function')
                msg.updateAck(sentAck, true);
            if (fn.updateNewsletterMsgRecord)
                await fn.updateNewsletterMsgRecord(msg);
            return {
                success: Boolean(resultNewsletter?.success),
                id: msg?.id?.toString?.() || rawMessage?.id?.toString?.() || null,
                newsletterId,
                ack: msg?.ack ?? null,
                serverId: msg?.serverId ?? resultNewsletter?.serverId ?? null,
                linkPreview: rawInput?.subtype === 'url',
                providerResult: resultNewsletter || null,
            };
        }, { newsletterId, body, linkPreview });
        return { operation, mode: 'newsletter-direct', result: value };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new common_1.BadRequestException(`Publicação no canal falhou: ${message.slice(0, 2000)}`);
    }
}
function requireClient(whatsapp, instanceId) {
    const client = whatsapp.clients?.get(instanceId);
    if (!client)
        throw new common_1.BadRequestException('Este número não está conectado ao WhatsApp.');
    return client;
}
function requireNewsletterId(value) {
    const newsletterId = requireText(value, 'newsletterId');
    if (!/^\d+@newsletter$/.test(newsletterId)) {
        throw new common_1.BadRequestException('newsletterId deve ter o formato numérico ...@newsletter.');
    }
    return newsletterId;
}
function requireText(value, field) {
    const text = String(value ?? '').trim();
    if (!text)
        throw new common_1.BadRequestException(`${field} é obrigatório.`);
    return text;
}
function requirePublicHttpUrl(value, field) {
    const text = requireText(value, field);
    let url;
    try {
        url = new URL(text);
    }
    catch {
        throw new common_1.BadRequestException(`${field} deve ser uma URL válida.`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new common_1.BadRequestException(`${field} deve usar http ou https.`);
    }
    return url.toString();
}
async function normalizeMediaInput(value, mimetype) {
    const media = requireText(value, 'media');
    if (/^data:[^;,]+;base64,/i.test(media))
        return media;
    if (/^[A-Za-z0-9+/\r\n]+=*$/.test(media) && media.replace(/\s+/g, '').length >= 32) {
        return `data:${mimetype || 'application/octet-stream'};base64,${media.replace(/\s+/g, '')}`;
    }
    let current;
    try {
        current = new URL(media);
    }
    catch {
        throw new common_1.BadRequestException('media deve ser uma URL pública http/https, data URL ou Base64. Caminhos locais do servidor não são aceitos.');
    }
    if (!['http:', 'https:'].includes(current.protocol)) {
        throw new common_1.BadRequestException('media deve usar http/https, data URL ou Base64.');
    }
    let response = null;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
        await assertPublicHost(current.hostname);
        response = await fetch(current, { redirect: 'manual' });
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location || redirects === 5)
                throw new common_1.BadRequestException('Não foi possível seguir o redirecionamento da mídia.');
            current = new URL(location, current);
            if (!['http:', 'https:'].includes(current.protocol))
                throw new common_1.BadRequestException('Redirecionamento da mídia usa protocolo não permitido.');
            continue;
        }
        break;
    }
    if (!response?.ok)
        throw new common_1.BadRequestException(`Não foi possível baixar a mídia (${response?.status || 'sem resposta'}).`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_MEDIA_BYTES)
        throw new common_1.BadRequestException('A mídia excede o limite de segurança de 64 MB do conector.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_MEDIA_BYTES)
        throw new common_1.BadRequestException('A mídia excede o limite de segurança de 64 MB do conector.');
    const responseMime = String(response.headers.get('content-type') || '').split(';')[0].trim();
    const type = responseMime || mimetype || 'application/octet-stream';
    return `data:${type};base64,${buffer.toString('base64')}`;
}
async function assertPublicHost(hostname) {
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
        throw new common_1.BadRequestException('URLs locais ou privadas não são permitidas para mídia.');
    }
    const addresses = (0, net_1.isIP)(normalized)
        ? [{ address: normalized }]
        : await (0, promises_1.lookup)(normalized, { all: true }).catch(() => []);
    if (!addresses.length)
        throw new common_1.BadRequestException('Não foi possível resolver o host da mídia.');
    if (addresses.some(({ address }) => isPrivateIp(address))) {
        throw new common_1.BadRequestException('URLs que resolvem para redes locais ou privadas não são permitidas para mídia.');
    }
}
function isPrivateIp(value) {
    const ip = value.toLowerCase();
    if (ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb'))
        return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    const v4 = mapped || ((0, net_1.isIP)(ip) === 4 ? ip : '');
    if (!v4)
        return false;
    const parts = v4.split('.').map(Number);
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
function defaultFilename(type) {
    if (type === 'image')
        return 'imagem.jpg';
    if (type === 'audio')
        return 'audio.mp3';
    if (type === 'video')
        return 'video.mp4';
    return 'arquivo';
}
function defaultMime(type) {
    if (type === 'image')
        return 'image/jpeg';
    if (type === 'audio')
        return 'audio/mpeg';
    if (type === 'video')
        return 'video/mp4';
    return 'application/octet-stream';
}
//# sourceMappingURL=whatsapp-channel-publisher.js.map