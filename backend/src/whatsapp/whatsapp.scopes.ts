export const WHATSAPP_SCOPES = [
  'connection:read',
  'messages:read',
  'messages:send',
  'contacts:read',
  'contacts:write',
  'groups:read',
  'groups:history',
  'groups:media',
  'groups:members:read',
  'groups:join',
  'groups:members:add',
  'groups:members:remove',
  'groups:requests:read',
  'groups:requests:write',
  'groups:send',
  'channels:read',
  'channels:publish',
  'status:publish',
] as const;

export type WhatsAppScope = (typeof WHATSAPP_SCOPES)[number];

export const DEFAULT_WHATSAPP_SCOPES: WhatsAppScope[] = [
  'connection:read',
  'messages:read',
  'messages:send',
  'contacts:read',
  'groups:read',
];

export function sanitizeWhatsAppScopes(value: unknown): WhatsAppScope[] {
  if (!Array.isArray(value)) return [...DEFAULT_WHATSAPP_SCOPES];
  const allowed = new Set<string>(WHATSAPP_SCOPES);
  return Array.from(new Set(value.map(String).filter((scope) => allowed.has(scope)))) as WhatsAppScope[];
}
