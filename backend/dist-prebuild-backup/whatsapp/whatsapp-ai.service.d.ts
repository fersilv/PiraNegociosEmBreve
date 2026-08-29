import { SettingsService } from '../admin/settings.service';
export type WhatsAppConciergeDecision = {
    intent: string;
    reply: string;
    args?: Record<string, unknown>;
    statePatch?: Record<string, unknown>;
    requiresConfirmation?: boolean;
};
export declare class WhatsAppAiService {
    private readonly settings;
    constructor(settings: SettingsService);
    decide(input: {
        actor: Record<string, unknown>;
        contextMode: string;
        activeFlow?: string | null;
        flowState?: Record<string, unknown>;
        messages: string[];
        history: Array<{
            direction: string;
            body: string | null;
            createdAt?: unknown;
        }>;
        availableContext?: Record<string, unknown>;
    }): Promise<WhatsAppConciergeDecision>;
    private answerAdmin;
    composeReply(input: {
        firstName?: string | null;
        request: string;
        result: unknown;
        contextMode: string;
    }): Promise<any>;
    explainOperationalError(input: {
        title: string;
        error: string;
        context: Record<string, unknown>;
    }): Promise<any>;
    private runtime;
    private generate;
    private parseDecision;
}
