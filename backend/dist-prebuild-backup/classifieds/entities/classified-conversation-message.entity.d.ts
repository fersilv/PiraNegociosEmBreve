export type ClassifiedConversationMessageType = 'TEXT' | 'OFFER' | 'SYSTEM';
export type ClassifiedConversationSide = 'BUYER' | 'SELLER';
export declare class ClassifiedConversationMessage {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderRole: ClassifiedConversationSide;
    body: string;
    messageType: ClassifiedConversationMessageType;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
}
