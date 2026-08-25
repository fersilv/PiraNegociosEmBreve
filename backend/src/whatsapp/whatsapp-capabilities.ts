import {
  DEFAULT_WHATSAPP_SCOPES,
  WHATSAPP_CAPABILITIES as LEGACY_WHATSAPP_CAPABILITIES,
} from './whatsapp.scopes';
import { WPP_OPERATION_CAPABILITIES } from './whatsapp-operations.catalog';

export const ALL_WHATSAPP_CAPABILITIES = [
  ...LEGACY_WHATSAPP_CAPABILITIES.map((capability) => ({ ...capability, legacy: true as const })),
  ...WPP_OPERATION_CAPABILITIES.map((capability) => ({ ...capability, legacy: false as const })),
];

export const ALL_WHATSAPP_SCOPES = ALL_WHATSAPP_CAPABILITIES.map((capability) => capability.scope);

export function sanitizeAllWhatsAppScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_WHATSAPP_SCOPES];
  const allowed = new Set<string>(ALL_WHATSAPP_SCOPES);
  return Array.from(new Set(value.map(String).filter((scope) => allowed.has(scope))));
}

export function getAllWhatsAppCapability(scope: string) {
  return ALL_WHATSAPP_CAPABILITIES.find((capability) => capability.scope === scope) || null;
}
