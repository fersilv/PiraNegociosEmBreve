import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsAiReviewService } from './classifieds-ai-review.service';
export declare class ClassifiedsCommerceService implements OnModuleInit, OnModuleDestroy {
    private readonly dataSource;
    private readonly identities;
    private readonly notifications;
    private readonly aiReview;
    private expirationTimer;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService, notifications: NotificationsService, aiReview: ClassifiedsAiReviewService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    limits(uid: string): Promise<{
        photoLimit: number;
        plan: string;
        paid: boolean;
    }>;
    assertImageLimit(uid: string, rawImages: unknown): Promise<{
        photoLimit: number;
        plan: string;
        paid: boolean;
    }>;
    createOffer(uid: string, listingId: string, rawAmount: unknown): Promise<any>;
    listOffers(uid: string): Promise<any>;
    respondOffer(uid: string, offerId: string, rawDecision: unknown): Promise<any>;
    withdrawOffer(uid: string, offerId: string): Promise<any>;
    expireDueOffers(): Promise<{
        expired: any;
    }>;
    analytics(uid: string): Promise<{
        totals: any;
        listings: any;
        daily: any;
    }>;
    trackEvent(listingId: string, eventType: string, actorUserId?: string | null, actorCompanyId?: string | null, metadata?: Record<string, unknown> | null): Promise<void>;
    decorateConversations(uid: string, conversations: any[]): Promise<any[]>;
    renameConversation(uid: string, conversationId: string, rawName: unknown): Promise<any>;
    companyLabels(uid: string): Promise<any>;
    createCompanyLabel(uid: string, rawName: unknown, rawColor: unknown): Promise<any>;
    setConversationLabels(uid: string, conversationId: string, rawIds: unknown): Promise<any>;
    moderatePublishedListing(uid: string, listingId: string): Promise<{
        checked: boolean;
        duplicate: boolean;
        duplicateListingId: string | null;
        confidence: number;
        reason: string;
        provider?: string | null;
        model?: string | null;
    } | {
        checked: boolean;
        reason: string;
        duplicate?: undefined;
    } | {
        checked: boolean;
        duplicate: boolean;
        reason: string;
    } | {
        status: string;
        checked: boolean;
        duplicate: boolean;
        duplicateListingId: string | null;
        confidence: number;
        reason: string;
        provider?: string | null;
        model?: string | null;
    }>;
    private reviewShape;
    private assertConversationAccess;
    private ensureDefaultLabels;
    private notifyIdentity;
    private decorateOffer;
    private money;
    private currency;
    private color;
}
