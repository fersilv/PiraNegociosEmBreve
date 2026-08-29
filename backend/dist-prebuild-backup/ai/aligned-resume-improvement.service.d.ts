import { SettingsService } from '../admin/settings.service';
import { User } from '../users/entities/user.entity';
import { ResumeReviewService, type ResumeReviewResult } from './resume-review.service';
import type { ResumeImprovementChange, ResumeImprovementProposal } from './resume-improvement.service';
type QualificationTarget = {
    id: string;
    text: string;
};
type NeedUserInput = {
    targetId: string;
    suggestion: string;
    reason: string;
};
type AlignedImprovementChange = ResumeImprovementChange & {
    targetIds: string[];
};
export type AlignedResumeImprovementProposal = ResumeImprovementProposal & {
    baselineAnalysis: ResumeReviewResult;
    qualificationTargets: QualificationTarget[];
    needsUserInput: NeedUserInput[];
    changes: AlignedImprovementChange[];
};
export declare class AlignedResumeImprovementService {
    private readonly settingsService;
    private readonly resumeReviewService;
    constructor(settingsService: SettingsService, resumeReviewService: ResumeReviewService);
    private isProvider;
    private config;
    private extractJsonObject;
    private normalizeJsonControls;
    private removeTrailingJsonCommas;
    private repairJsonAtParsePosition;
    private parseJson;
    private systemInstruction;
    private generateRaw;
    private cleanText;
    private cleanSkills;
    private targetIds;
    private buildTargets;
    private normalize;
    private profileForPrompt;
    private makePrompt;
    propose(profile: User): Promise<AlignedResumeImprovementProposal>;
    applySelected(profile: User, proposal: ResumeImprovementProposal, selectedIds: string[]): {
        bio: string;
        skills: string[];
        resumePreferences: Record<string, unknown>;
        experiences: any[];
    };
}
export {};
