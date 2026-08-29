import { SettingsService } from '../admin/settings.service';
export type ReviewModerationResult = {
    checked: boolean;
    decision: 'APPROVE' | 'REJECT' | 'MANUAL';
    reason: string;
    provider?: string | null;
    model?: string | null;
};
export declare class ClassifiedsReviewModerationService {
    private readonly settings;
    constructor(settings: SettingsService);
    moderate(input: {
        comment?: string | null;
        photoUrls?: string[];
        ratings: Record<string, number | null>;
    }): Promise<ReviewModerationResult>;
    private parseJson;
    private generate;
}
