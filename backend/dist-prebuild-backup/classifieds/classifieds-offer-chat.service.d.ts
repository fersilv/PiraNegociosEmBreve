import { DataSource } from 'typeorm';
export type ClassifiedOfferChatEvent = 'CREATED' | 'UPDATED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
export declare class ClassifiedsOfferChatService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    record(uid: string, offerId: string, event: ClassifiedOfferChatEvent): Promise<{
        conversationId: any;
        message: any;
        recipientIds: any[];
    } | null>;
}
