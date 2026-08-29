import { ClassifiedsReviewsService } from './classifieds-reviews.service';
export declare class ClassifiedsReviewsController {
    private readonly reviews;
    constructor(reviews: ClassifiedsReviewsService);
    eligible(req: any): Promise<any>;
    mine(req: any): Promise<any>;
    submit(req: any, orderId: string, body: Record<string, unknown>): Promise<{
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
}
export declare class ClassifiedsReviewsPublicController {
    private readonly reviews;
    constructor(reviews: ClassifiedsReviewsService);
    listing(listingId: string): Promise<{
        summary: {
            average: number | null;
            count: number;
        };
        reviews: any;
    }>;
    company(companyId: string): Promise<{
        reviewCount: number;
        overallAverage: number | null;
        serviceAverage: number | null;
        companyAverage: number | null;
    }>;
}
export declare class ClassifiedsReviewsAdminController {
    private readonly reviews;
    constructor(reviews: ClassifiedsReviewsService);
    pending(): Promise<any>;
    moderate(reviewId: string, body: any): Promise<{
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
}
