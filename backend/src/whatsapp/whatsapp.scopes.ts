import { WPP_OPERATION_CAPABILITIES } from './whatsapp-operations.catalog';

export type WhatsAppCapabilityRisk = 'read' | 'write' | 'destructive';

export type WhatsAppCapability = {
  scope: string;
  category: string;
  label: string;
  description: string;
  risk: WhatsAppCapabilityRisk;
  experimental?: boolean;
  method?: string;
  signature?: string;
  legacy?: boolean;
  event?: boolean;
};

const LEGACY_WHATSAPP_CAPABILITIES: WhatsAppCapability[] = [
  { scope: 'connection:read', category: 'Compatibilidade', label: 'Consultar conexão', description: 'Scope legado para consultar o estado da sessão.', risk: 'read', legacy: true },
  { scope: 'messages:read', category: 'Compatibilidade', label: 'Ler mensagens monitoradas', description: 'Scope legado para consultar mensagens persistidas pelo PiraNegócios.', risk: 'read', legacy: true },
  { scope: 'messages:send', category: 'Compatibilidade', label: 'Enviar mensagens', description: 'Scope legado de envio de texto.', risk: 'write', legacy: true },
  { scope: 'contacts:read', category: 'Compatibilidade', label: 'Ler contatos', description: 'Scope legado de consulta de contatos.', risk: 'read', legacy: true },
  { scope: 'contacts:write', category: 'Compatibilidade', label: 'Salvar contatos internos', description: 'Scope legado do diretório interno.', risk: 'write', legacy: true },
  { scope: 'groups:read', category: 'Compatibilidade', label: 'Listar grupos', description: 'Scope legado para listar grupos.', risk: 'read', legacy: true },
  { scope: 'groups:history', category: 'Compatibilidade', label: 'Histórico de grupo', description: 'Scope legado de histórico paginado de grupos.', risk: 'read', legacy: true },
  { scope: 'groups:media', category: 'Compatibilidade', label: 'Mídias de grupo', description: 'Scope legado para baixar mídias de mensagens do grupo.', risk: 'read', legacy: true },
  { scope: 'groups:members:read', category: 'Compatibilidade', label: 'Participantes do grupo', description: 'Scope legado para listar participantes.', risk: 'read', legacy: true },
  { scope: 'groups:join', category: 'Compatibilidade', label: 'Entrar no grupo', description: 'Scope legado para entrar por convite.', risk: 'write', legacy: true },
  { scope: 'groups:members:add', category: 'Compatibilidade', label: 'Adicionar participante', description: 'Scope legado para adicionar participante.', risk: 'write', legacy: true },
  { scope: 'groups:members:remove', category: 'Compatibilidade', label: 'Remover participante', description: 'Scope legado para remover participante.', risk: 'destructive', legacy: true },
  { scope: 'groups:requests:read', category: 'Compatibilidade', label: 'Pedidos de entrada', description: 'Scope legado para consultar pedidos de entrada.', risk: 'read', legacy: true },
  { scope: 'groups:requests:write', category: 'Compatibilidade', label: 'Decidir pedidos de entrada', description: 'Scope legado para aprovar/rejeitar pedidos.', risk: 'write', legacy: true },
  { scope: 'groups:send', category: 'Compatibilidade', label: 'Enviar no grupo', description: 'Scope legado para publicar texto em grupos.', risk: 'write', legacy: true },
  { scope: 'channels:read', category: 'Compatibilidade', label: 'Consultar canais', description: 'Scope legado de canais/newsletters.', risk: 'read', legacy: true },
  { scope: 'channels:publish', category: 'Compatibilidade', label: 'Publicar em canal', description: 'Scope legado para publicação em canais.', risk: 'write', legacy: true },
  { scope: 'status:publish', category: 'Compatibilidade', label: 'Publicar status', description: 'Scope legado para publicar status.', risk: 'write', legacy: true },
];

const CUSTOM_WHATSAPP_CAPABILITIES: WhatsAppCapability[] = [
  {
    scope: 'groups:reply',
    category: 'Grupos · Moderação',
    label: 'Responder mensagem no grupo',
    description: 'Permite responder uma mensagem específica do grupo sem liberar envio de mensagem avulsa.',
    risk: 'write',
    signature: 'replyGroup(groupId, messageId, text)',
    legacy: false,
  },
  {
    scope: 'groups:reaction',
    category: 'Grupos · Moderação',
    label: 'Reagir a mensagem do grupo',
    description: 'Permite reagir a uma mensagem específica com emoji sem publicar texto novo.',
    risk: 'write',
    signature: 'reactGroupMessage(messageId, reactionOrFalse)',
    legacy: false,
  },
  {
    scope: 'groups:message:delete',
    category: 'Grupos · Moderação',
    label: 'Remover mensagem do grupo',
    description: 'Permite apagar uma mensagem específica do grupo quando o WhatsApp e as permissões de administrador permitirem.',
    risk: 'destructive',
    signature: 'deleteGroupMessage(groupId, messageId, onlyLocal?)',
    legacy: false,
  },
  {
    scope: 'channels:publish:image',
    category: 'Canais',
    label: 'Publicar imagem em canal',
    description: 'Publica uma imagem em canal/newsletter usando URL pública, data URL ou Base64.',
    risk: 'write',
    signature: 'publishChannelImage(newsletterId, media, filename?, mimetype?)',
    experimental: true,
    legacy: false,
  },
  {
    scope: 'channels:publish:image-caption',
    category: 'Canais',
    label: 'Publicar imagem com legenda',
    description: 'Publica imagem com legenda em canal/newsletter pelo pipeline específico de mídia.',
    risk: 'write',
    signature: 'publishChannelImageWithCaption(newsletterId, media, caption, filename?, mimetype?)',
    experimental: true,
    legacy: false,
  },
  {
    scope: 'channels:publish:link',
    category: 'Canais',
    label: 'Publicar link em canal',
    description: 'Publica uma URL em canal/newsletter e tenta gerar a prévia nativa do link.',
    risk: 'write',
    signature: 'publishChannelLink(newsletterId, url)',
    experimental: true,
    legacy: false,
  },
  {
    scope: 'channels:publish:text-link',
    category: 'Canais',
    label: 'Publicar texto com link',
    description: 'Publica texto seguido de URL em canal/newsletter e tenta gerar a prévia nativa do link.',
    risk: 'write',
    signature: 'publishChannelTextWithLink(newsletterId, text, url)',
    experimental: true,
    legacy: false,
  },
  {
    scope: 'channels:publish:file',
    category: 'Canais',
    label: 'Publicar arquivo com legenda',
    description: 'Publica documento ou arquivo em canal/newsletter, com nome, MIME e legenda opcionais.',
    risk: 'write',
    signature: 'publishChannelFile(newsletterId, media, filename, caption?, mimetype?)',
    experimental: true,
    legacy: false,
  },
  {
    scope: 'channels:publish:audio',
    category: 'Canais',
    label: 'Publicar áudio em canal',
    description: 'Publica áudio em canal/newsletter; pode solicitar modo PTT/voz quando o WhatsApp suportar.',
    risk: 'write',
    signature: 'publishChannelAudio(newsletterId, media, filename?, mimetype?, asVoice?)',
    experimental: true,
    legacy: false,
  },
  {
    scope: 'channels:publish:video',
    category: 'Canais',
    label: 'Publicar vídeo com legenda',
    description: 'Publica vídeo em canal/newsletter com legenda opcional.',
    risk: 'write',
    signature: 'publishChannelVideo(newsletterId, media, caption?, filename?, mimetype?)',
    experimental: true,
    legacy: false,
  },
];

export const WHATSAPP_CAPABILITIES: WhatsAppCapability[] = [
  ...LEGACY_WHATSAPP_CAPABILITIES,
  ...CUSTOM_WHATSAPP_CAPABILITIES,
  ...(WPP_OPERATION_CAPABILITIES.map((capability) => ({ ...capability, legacy: false })) as WhatsAppCapability[]),
];

export const WHATSAPP_SCOPES = WHATSAPP_CAPABILITIES.map((capability) => capability.scope);
export type WhatsAppScope = string;

export const DEFAULT_WHATSAPP_SCOPES: WhatsAppScope[] = [
  'connection:read',
  'messages:read',
  'contacts:read',
  'groups:read',
];

export function sanitizeWhatsAppScopes(value: unknown): WhatsAppScope[] {
  if (!Array.isArray(value)) return [...DEFAULT_WHATSAPP_SCOPES];
  const allowed = new Set<string>(WHATSAPP_SCOPES);
  return Array.from(new Set(value.map(String).filter((scope) => allowed.has(scope))));
}

export function getWhatsAppCapability(scope: string) {
  return WHATSAPP_CAPABILITIES.find((capability) => capability.scope === scope) || null;
}
