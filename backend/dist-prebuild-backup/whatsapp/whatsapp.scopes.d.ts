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
export declare const WHATSAPP_CAPABILITIES: WhatsAppCapability[];
export declare const WHATSAPP_SCOPES: string[];
export type WhatsAppScope = string;
export declare const DEFAULT_WHATSAPP_SCOPES: WhatsAppScope[];
export declare function sanitizeWhatsAppScopes(value: unknown): WhatsAppScope[];
export declare function getWhatsAppCapability(scope: string): WhatsAppCapability | null;
