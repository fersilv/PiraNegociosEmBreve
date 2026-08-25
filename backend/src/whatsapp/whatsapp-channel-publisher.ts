import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { WhatsAppService } from './whatsapp.service';

type ChannelMediaType = 'image' | 'document' | 'audio' | 'video';

type ChannelMediaOptions = {
  media: string;
  type: ChannelMediaType;
  caption?: string;
  filename?: string;
  mimetype?: string;
  asVoice?: boolean;
};

const MAX_MEDIA_BYTES = 64 * 1024 * 1024;

export async function publishChannelLink(
  whatsapp: WhatsAppService,
  instanceId: string,
  newsletterIdRaw: string,
  urlRaw: string,
) {
  const newsletterId = requireNewsletterId(newsletterIdRaw);
  const url = requirePublicHttpUrl(urlRaw, 'url');
  return publishRichText(whatsapp, instanceId, newsletterId, url, true, 'publishChannelLink');
}

export async function publishChannelTextWithLink(
  whatsapp: WhatsAppService,
  instanceId: string,
  newsletterIdRaw: string,
  textRaw: string,
  urlRaw: string,
) {
  const newsletterId = requireNewsletterId(newsletterIdRaw);
  const text = requireText(textRaw, 'text');
  const url = requirePublicHttpUrl(urlRaw, 'url');
  const body = `${text}\n${url}`;
  if (body.length > 4096) throw new BadRequestException('text + url deve ter no máximo 4096 caracteres.');
  return publishRichText(whatsapp, instanceId, newsletterId, body, true, 'publishChannelTextWithLink');
}

export async function publishChannelMedia(
  whatsapp: WhatsAppService,
  instanceId: string,
  newsletterIdRaw: string,
  options: ChannelMediaOptions,
) {
  const newsletterId = requireNewsletterId(newsletterIdRaw);
  const client = requireClient(whatsapp, instanceId);
  if (!client.page?.evaluate) {
    throw new BadRequestException('A sessão atual não expõe a página do WhatsApp para publicar mídia no canal.');
  }

  const type = options.type;
  const caption = options.caption == null ? undefined : String(options.caption).trim().slice(0, 4096);
  const filename = String(options.filename || defaultFilename(type)).trim().slice(0, 180);
  const mimetype = String(options.mimetype || defaultMime(type)).trim().slice(0, 120);
  const media = await normalizeMediaInput(options.media, mimetype);

  try {
    const value = await client.page.evaluate(
      async ({ newsletterId, media, type, caption, filename, mimetype, asVoice }: {
        newsletterId: string;
        media: string;
        type: ChannelMediaType;
        caption?: string;
        filename: string;
        mimetype: string;
        asVoice: boolean;
      }) => {
        const wpp = (globalThis as any).WPP;
        const newsletter = wpp?.whatsapp?.NewsletterStore?.get?.(newsletterId);
        if (!newsletter) throw new Error(`Newsletter ${newsletterId} não foi encontrada na NewsletterStore da sessão.`);
        if (!wpp?.chat?.sendFileMessage || typeof wpp?.chat?.find !== 'function') {
          throw new Error('O pipeline de mídia do WA-JS não está disponível nesta sessão.');
        }

        // WA-JS 4.6 prepara mídia corretamente, mas assertFindChat resolve apenas
        // ChatStore. Durante esta chamada desviamos somente este newsletterId para
        // a NewsletterStore e delegamos todos os demais IDs ao find original.
        const originalFind = wpp.chat.find;
        const bridgedFind = async (...args: any[]) => {
          const requested = args[0]?.toString?.() || String(args[0] || '');
          if (requested === newsletterId) return newsletter;
          return originalFind.apply(wpp.chat, args);
        };

        let restoreFind: (() => void) | null = null;
        const descriptor = Object.getOwnPropertyDescriptor(wpp.chat, 'find');
        try {
          if (!descriptor || descriptor.writable) {
            wpp.chat.find = bridgedFind;
            restoreFind = () => { wpp.chat.find = originalFind; };
          } else if (descriptor.configurable) {
            Object.defineProperty(wpp.chat, 'find', { ...descriptor, value: bridgedFind });
            restoreFind = () => Object.defineProperty(wpp.chat, 'find', descriptor);
          } else {
            throw new Error('WPP.chat.find não pode ser temporariamente adaptado nesta versão do WA-JS.');
          }

          const sendOptions: Record<string, unknown> = {
            type,
            filename,
            mimetype,
            waitForAck: true,
          };
          if (caption !== undefined) sendOptions.caption = caption;
          if (type === 'audio') sendOptions.isPtt = asVoice;

          const result = await wpp.chat.sendFileMessage(newsletterId, media, sendOptions);
          return {
            success: true,
            newsletterId,
            type,
            caption: caption ?? null,
            filename,
            mimetype,
            result,
          };
        } finally {
          restoreFind?.();
        }
      },
      {
        newsletterId,
        media,
        type,
        caption,
        filename,
        mimetype,
        asVoice: Boolean(options.asVoice),
      },
    );

    return {
      operation: `publishChannel${type.charAt(0).toUpperCase()}${type.slice(1)}`,
      scope: `channels:publish:${type === 'document' ? 'file' : type}`,
      mode: 'newsletter-media-bridge',
      result: value,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BadRequestException(`Publicação de ${type} no canal falhou: ${message.slice(0, 2000)}`);
  }
}

async function publishRichText(
  whatsapp: WhatsAppService,
  instanceId: string,
  newsletterId: string,
  body: string,
  linkPreview: boolean,
  operation: string,
) {
  const client = requireClient(whatsapp, instanceId);
  if (!client.page?.evaluate) {
    throw new BadRequestException('A sessão atual não expõe a página do WhatsApp para publicar no canal.');
  }

  try {
    const value = await client.page.evaluate(
      async ({ newsletterId, body, linkPreview }: { newsletterId: string; body: string; linkPreview: boolean }) => {
        const wpp = (globalThis as any).WPP;
        const wa = wpp?.whatsapp;
        const fn = wa?.functions;
        const chat = wa?.NewsletterStore?.get?.(newsletterId);
        if (!chat) throw new Error(`Newsletter ${newsletterId} não foi encontrada na NewsletterStore da sessão.`);
        if (!wpp?.chat?.prepareRawMessage || !wa?.MsgModel || !fn?.sendNewsletterMessageJob || !fn?.msgDataFromMsgModel) {
          throw new Error('O pipeline interno de newsletter do WA-JS não está disponível nesta sessão.');
        }

        let rawInput: any = { type: 'chat', body, subtype: null, urlText: null, urlNumber: null };
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
          if (resultNewsletter.ack?.t) msg.t = resultNewsletter.ack.t;
          if (resultNewsletter.serverId != null) msg.serverId = resultNewsletter.serverId;
        }
        const sentAck = wa?.enums?.ACK?.SENT;
        if (sentAck != null && typeof msg.updateAck === 'function') msg.updateAck(sentAck, true);
        if (fn.updateNewsletterMsgRecord) await fn.updateNewsletterMsgRecord(msg);

        return {
          success: Boolean(resultNewsletter?.success),
          id: msg?.id?.toString?.() || rawMessage?.id?.toString?.() || null,
          newsletterId,
          ack: msg?.ack ?? null,
          serverId: msg?.serverId ?? resultNewsletter?.serverId ?? null,
          linkPreview: rawInput?.subtype === 'url',
          providerResult: resultNewsletter || null,
        };
      },
      { newsletterId, body, linkPreview },
    );

    return { operation, mode: 'newsletter-direct', result: value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BadRequestException(`Publicação no canal falhou: ${message.slice(0, 2000)}`);
  }
}

function requireClient(whatsapp: WhatsAppService, instanceId: string) {
  const client = (whatsapp as any).clients?.get(instanceId);
  if (!client) throw new BadRequestException('Este número não está conectado ao WhatsApp.');
  return client;
}

function requireNewsletterId(value: string) {
  const newsletterId = requireText(value, 'newsletterId');
  if (!/^\d+@newsletter$/.test(newsletterId)) {
    throw new BadRequestException('newsletterId deve ter o formato numérico ...@newsletter.');
  }
  return newsletterId;
}

function requireText(value: string, field: string) {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestException(`${field} é obrigatório.`);
  return text;
}

function requirePublicHttpUrl(value: string, field: string) {
  const text = requireText(value, field);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new BadRequestException(`${field} deve ser uma URL válida.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestException(`${field} deve usar http ou https.`);
  }
  return url.toString();
}

async function normalizeMediaInput(value: string, mimetype: string) {
  const media = requireText(value, 'media');
  if (/^data:[^;,]+;base64,/i.test(media)) return media;

  if (/^[A-Za-z0-9+/\r\n]+=*$/.test(media) && media.replace(/\s+/g, '').length >= 32) {
    return `data:${mimetype || 'application/octet-stream'};base64,${media.replace(/\s+/g, '')}`;
  }

  let current: URL;
  try {
    current = new URL(media);
  } catch {
    throw new BadRequestException('media deve ser uma URL pública http/https, data URL ou Base64. Caminhos locais do servidor não são aceitos.');
  }
  if (!['http:', 'https:'].includes(current.protocol)) {
    throw new BadRequestException('media deve usar http/https, data URL ou Base64.');
  }

  let response: Response | null = null;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertPublicHost(current.hostname);
    response = await fetch(current, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === 5) throw new BadRequestException('Não foi possível seguir o redirecionamento da mídia.');
      current = new URL(location, current);
      if (!['http:', 'https:'].includes(current.protocol)) throw new BadRequestException('Redirecionamento da mídia usa protocolo não permitido.');
      continue;
    }
    break;
  }

  if (!response?.ok) throw new BadRequestException(`Não foi possível baixar a mídia (${response?.status || 'sem resposta'}).`);
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_MEDIA_BYTES) throw new BadRequestException('A mídia excede o limite de segurança de 64 MB do conector.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_MEDIA_BYTES) throw new BadRequestException('A mídia excede o limite de segurança de 64 MB do conector.');
  const responseMime = String(response.headers.get('content-type') || '').split(';')[0].trim();
  const type = responseMime || mimetype || 'application/octet-stream';
  return `data:${type};base64,${buffer.toString('base64')}`;
}

async function assertPublicHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    throw new BadRequestException('URLs locais ou privadas não são permitidas para mídia.');
  }

  const addresses = isIP(normalized)
    ? [{ address: normalized }]
    : await lookup(normalized, { all: true }).catch(() => [] as Array<{ address: string }>);
  if (!addresses.length) throw new BadRequestException('Não foi possível resolver o host da mídia.');
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new BadRequestException('URLs que resolvem para redes locais ou privadas não são permitidas para mídia.');
  }
}

function isPrivateIp(value: string) {
  const ip = value.toLowerCase();
  if (ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const v4 = mapped || (isIP(ip) === 4 ? ip : '');
  if (!v4) return false;
  const parts = v4.split('.').map(Number);
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

function defaultFilename(type: ChannelMediaType) {
  if (type === 'image') return 'imagem.jpg';
  if (type === 'audio') return 'audio.mp3';
  if (type === 'video') return 'video.mp4';
  return 'arquivo';
}

function defaultMime(type: ChannelMediaType) {
  if (type === 'image') return 'image/jpeg';
  if (type === 'audio') return 'audio/mpeg';
  if (type === 'video') return 'video/mp4';
  return 'application/octet-stream';
}
