import { SettingsService } from '../admin/settings.service';
type ReviewCandidate = {
    id: string;
    title: string;
    description: string;
    categorySlug: string;
    listingType: string;
    price: string | null;
    imageUrls: string[];
};
type ReviewInput = {
    listing: ReviewCandidate;
    candidates: ReviewCandidate[];
};
type ReviewResult = {
    checked: boolean;
    duplicate: boolean;
    duplicateListingId: string | null;
    confidence: number;
    reason: string;
    provider?: string | null;
    model?: string | null;
};
export declare class ClassifiedsAiReviewService {
    private readonly settings;
    constructor(settings: SettingsService);
    review(input: ReviewInput): Promise<ReviewResult>;
    private enrichPhotoSignals;
    private hashImages;
    private absoluteUrl;
    private parseJson;
    private generate;
}
export {};
