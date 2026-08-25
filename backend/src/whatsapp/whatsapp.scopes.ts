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

export const WHATSAPP_CAPABILITIES: WhatsAppCapability[] = [
  ...LEGACY_WHATSAPP_CAPABILITIES,
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
