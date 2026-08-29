export declare class ClassifiedConversation {
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
}
