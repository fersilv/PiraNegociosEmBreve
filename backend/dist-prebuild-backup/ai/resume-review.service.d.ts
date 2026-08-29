import { SettingsService } from '../admin/settings.service';
export interface ResumeReviewBreakdown {
    summaryPositioning: number;
    experienceStructure: number;
    experienceEvidence: number;
    skills: number;
    educationCourses: number;
    consistency: number;
    readabilityAts: number;
}
export interface ResumeReviewResult {
    score: number;
    breakdown: ResumeReviewBreakdown;
    strengths: string[];
    suggestions: string[];
    feedbackText: string;
    missingSections: string[];
    parsedAt: string;
    resumeSignature?: string;
}
export declare class ResumeReviewService {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    private isProvider;
    private getRuntimeConfig;
    private extractJsonObject;
    private normalizeJsonControls;
    private removeTrailingJsonCommas;
    private repairJsonAtParsePosition;
    private parseJson;
    private stringArray;
    private clampDimension;
    private normalize;
    private cleanText;
    private cleanSkills;
    private profileForReview;
    private serialize;
    private fnv1a;
    private buildSystemInstruction;
    private generateRaw;
    private generate;
    review(profile: unknown): Promise<ResumeReviewResult>;
}
