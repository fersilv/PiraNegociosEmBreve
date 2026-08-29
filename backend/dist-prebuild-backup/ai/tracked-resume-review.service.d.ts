import { SettingsService } from '../admin/settings.service';
import { ResumeReviewService, type ResumeReviewResult } from './resume-review.service';
export type TrackedResumeReviewResult = ResumeReviewResult & {
    resumeSignature: string;
};
export declare class TrackedResumeReviewService extends ResumeReviewService {
    constructor(settingsService: SettingsService);
    resumeSignature(profile: unknown): string;
    review(profile: unknown): Promise<TrackedResumeReviewResult>;
}
