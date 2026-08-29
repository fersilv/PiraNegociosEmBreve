export declare class WhatsAppConversation {
    id: string;
    instanceId: string;
    chatId: string;
    whatsappId: string | null;
    phoneE164: string | null;
    userId: string | null;
    companyId: string | null;
    contextMode: string;
    activeFlow: string | null;
    state: Record<string, unknown>;
    lastInboundAt: Date | null;
    lastProcessedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class WhatsAppPhoneOtp {
    id: string;
    userId: string;
    instanceId: string;
    phoneE164: string;
    whatsappId: string | null;
    codeHash: string;
    attempts: number;
    expiresAt: Date;
    verifiedAt: Date | null;
    createdAt: Date;
}
