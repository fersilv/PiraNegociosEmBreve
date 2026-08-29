export declare enum WhatsAppMessageDirection {
    INBOUND = "INBOUND",
    OUTBOUND = "OUTBOUND"
}
export declare class WhatsAppMessage {
    id: string;
    instanceId: string;
    providerMessageId: string | null;
    chatId: string;
    senderId: string | null;
    direction: WhatsAppMessageDirection;
    type: string;
    body: string | null;
    metadata: Record<string, unknown> | null;
    providerTimestamp: Date | null;
    createdAt: Date;
}
