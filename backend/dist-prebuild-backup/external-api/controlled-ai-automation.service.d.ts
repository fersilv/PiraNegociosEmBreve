import { DataSource } from 'typeorm';
export declare class ControlledAiAutomationService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    private safeLimit;
    private optionalQuery;
    status(): Promise<{
        internalAutomaticAi: boolean;
        policy: string;
        queues: {
            jobMatchProfiles: number;
            classifiedsListings: number;
            classifiedsReviews: number;
            productFeedback: number;
        };
    }>;
    listingModerationQueue(limitRaw?: unknown): Promise<{
        data: any;
        count: any;
        limit: number;
    }>;
    listingModerationContext(listingId: string, limitRaw?: unknown): Promise<{
        listing: any;
        candidates: any;
    }>;
    applyListingModeration(listingId: string, decisionRaw: unknown, reasonRaw?: unknown, duplicateOfListingId?: string | null): Promise<any>;
    reviewModerationQueue(limitRaw?: unknown): Promise<{
        data: any;
        count: any;
        limit: number;
    }>;
    applyReviewModeration(reviewId: string, decisionRaw: unknown, reasonRaw?: unknown): Promise<any>;
    feedbackQueue(limitRaw?: unknown): Promise<{
        data: any;
        count: any;
        limit: number;
    }>;
    faqSource(limitRaw?: unknown): Promise<{
        data: any;
        count: any;
        limit: number;
    }>;
    applyFeedbackInsights(clusters: Array<Record<string, unknown>>): Promise<{
        saved: number;
    }>;
    applyFaqs(articles: Array<Record<string, unknown>>): Promise<{
        saved: number;
    }>;
    private slug;
}
