import { Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedConversation } from './entities/classified-conversation.entity';
import { ClassifiedConversationMessage } from './entities/classified-conversation-message.entity';
import { ClassifiedListing } from './entities/classified-listing.entity';
import { ClassifiedListingImage } from './entities/classified-listing-image.entity';
export declare class ClassifiedsChatService {
    private readonly conversations;
    private readonly messages;
    private readonly listings;
    private readonly images;
    private readonly users;
    private readonly companies;
    private readonly identities;
    constructor(conversations: Repository<ClassifiedConversation>, messages: Repository<ClassifiedConversationMessage>, listings: Repository<ClassifiedListing>, images: Repository<ClassifiedListingImage>, users: Repository<User>, companies: Repository<Company>, identities: ClassifiedsIdentityService);
    start(listingId: string, uid: string): Promise<{
        role: "BUYER" | "SELLER";
        unreadCount: number;
        listing: {
            id: string;
            slug: string;
            title: string;
            price: string | null;
            priceType: import("./entities/classified-listing.entity").ClassifiedPriceType;
            status: import("./entities/classified-listing.entity").ClassifiedListingStatus;
            image: string | null;
        } | null;
        buyer: {
            id: string;
            type: string;
            name: string;
            photoURL: string | null;
            verified: boolean;
        };
        seller: {
            id: string;
            type: string;
            name: string;
            photoURL: string | null;
            verified: boolean;
        };
        lastMessage: {
            id: string;
            senderId: string;
            senderRole: import("./entities/classified-conversation-message.entity").ClassifiedConversationSide;
            body: string;
            createdAt: Date;
        } | null;
        id: string;
        listingId: string;
        buyerUserId: string;
        buyerCompanyId: string | null;
        sellerUserId: string;
        sellerCompanyId: string | null;
        buyerLastReadAt: Date | null;
        sellerLastReadAt: Date | null;
        lastMessageAt: Date | null;
        buyerDeletedAt: Date | null;
        sellerDeletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    list(uid: string): Promise<{
        role: "BUYER" | "SELLER";
        unreadCount: number;
        listing: {
            id: string;
            slug: string;
            title: string;
            price: string | null;
            priceType: import("./entities/classified-listing.entity").ClassifiedPriceType;
            status: import("./entities/classified-listing.entity").ClassifiedListingStatus;
            image: string | null;
        } | null;
        buyer: {
            id: string;
            type: string;
            name: string;
            photoURL: string | null;
            verified: boolean;
        };
        seller: {
            id: string;
            type: string;
            name: string;
            photoURL: string | null;
            verified: boolean;
        };
        lastMessage: {
            id: string;
            senderId: string;
            senderRole: import("./entities/classified-conversation-message.entity").ClassifiedConversationSide;
            body: string;
            createdAt: Date;
        } | null;
        id: string;
        listingId: string;
        buyerUserId: string;
        buyerCompanyId: string | null;
        sellerUserId: string;
        sellerCompanyId: string | null;
        buyerLastReadAt: Date | null;
        sellerLastReadAt: Date | null;
        lastMessageAt: Date | null;
        buyerDeletedAt: Date | null;
        sellerDeletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    listMessages(conversationId: string, uid: string): Promise<ClassifiedConversationMessage[]>;
    archive(conversationId: string, uid: string): Promise<{
        archived: boolean;
    }>;
    send(conversationId: string, uid: string, rawBody: unknown, rawMetadata?: unknown): Promise<{
        message: ClassifiedConversationMessage;
        recipientIds: string[];
    }>;
    markRead(conversationId: string, uid: string): Promise<{
        ok: boolean;
    }>;
    private markReadEntity;
    private assertParticipant;
    private isSeller;
    private isCompanyOperator;
    private recipientIds;
    private addIdentityRecipients;
    private hydrate;
}
