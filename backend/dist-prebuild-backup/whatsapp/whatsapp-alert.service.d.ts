import { WhatsAppAiService } from './whatsapp-ai.service';
export type WhatsAppAlertSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL';
export declare class WhatsAppAlertService {
    private readonly ai;
    private readonly logger;
    private readonly apiUrl;
    constructor(ai: WhatsAppAiService);
    send(input: {
        severity: WhatsAppAlertSeverity;
        title: string;
        instanceName?: string | null;
        instanceId?: string | null;
        error?: unknown;
        context?: Record<string, unknown>;
    }): Promise<{
        status: "NOT_CONFIGURED";
        error?: undefined;
        messageId?: undefined;
    } | {
        status: "FAILED";
        error: string;
        messageId?: undefined;
    } | {
        status: "SENT";
        messageId: any;
        error?: undefined;
    }>;
    private errorText;
    private escape;
}
