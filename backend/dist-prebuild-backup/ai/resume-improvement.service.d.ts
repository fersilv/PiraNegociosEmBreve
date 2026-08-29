import { SettingsService } from '../admin/settings.service';
import { User } from '../users/entities/user.entity';
type ImprovementChangeType = 'BIO' | 'HEADLINE' | 'GLOBAL_SKILLS' | 'EXPERIENCE_DESCRIPTION' | 'STAGE_DESCRIPTION';
export interface ResumeImprovementChange {
    id: string;
    type: ImprovementChangeType;
    label: string;
    before: string | string[];
    after: string | string[];
    reason: string;
    experienceIndex?: number;
    stageIndex?: number;
}
export interface ResumeImprovementProposal {
    summary: string;
    changes: ResumeImprovementChange[];
    createdAt: string;
}
export declare class ResumeImprovementService {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    private isProvider;
    private config;
    private extractJsonObject;
    private normalizeJsonControls;
    private removeTrailingJsonCommas;
    private repairJsonAtParsePosition;
    private parseJson;
    private systemInstruction;
    private generate;
    private cleanText;
    private cleanSkills;
    private normalize;
    private profileForPrompt;
    propose(profile: User): Promise<ResumeImprovementProposal>;
    applySelected(profile: User, proposal: ResumeImprovementProposal, selectedIds: string[]): {
        bio: string;
        skills: string[];
        resumePreferences: Record<string, unknown>;
        experiences: any[];
    };
}
export {};
