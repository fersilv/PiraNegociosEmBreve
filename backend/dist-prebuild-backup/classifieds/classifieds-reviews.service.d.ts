import { DataSource } from 'typeorm';
export declare class ClassifiedsReviewsService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    eligible(uid: string): Promise<any>;
    mine(uid: string): Promise<any>;
    submit(uid: string, orderId: string, body: Record<string, unknown>): Promise<{
        id: any;
        orderId: any;
        listingId: any;
        companyId: any;
        productRating: number | null;
        serviceRating: number | null;
        companyRating: number | null;
        comment: any;
        photoUrls: string[];
        status: any;
        moderationReason: any;
        submittedAt: any;
        publishAt: any;
        publicNow: boolean;
    }>;
    publicListing(listingId: string): Promise<{
        summary: {
            average: number | null;
            count: number;
        };
        reviews: any;
    }>;
    publicCompany(companyId: string): Promise<{
        reviewCount: number;
        overallAverage: number | null;
        serviceAverage: number | null;
        companyAverage: number | null;
    }>;
    pendingModeration(): Promise<any>;
    moderateManually(reviewId: string, decisionRaw: unknown, reasonRaw: unknown): Promise<{
        id: any;
        orderId: any;
        listingId: any;
        companyId: any;
        productRating: number | null;
        serviceRating: number | null;
        companyRating: number | null;
        comment: any;
        photoUrls: string[];
        status: any;
        moderationReason: any;
        submittedAt: any;
        publishAt: any;
        publicNow: boolean;
    }>;
    private privateReview;
    private rating;
    private optionalRating;
    private photos;
    private array;
}
