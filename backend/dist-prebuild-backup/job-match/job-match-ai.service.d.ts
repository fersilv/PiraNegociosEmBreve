import { SettingsService } from '../admin/settings.service';
import { Job } from '../jobs/entities/job.entity';
export type WeightedJobRequirement = {
    label: string;
    type: 'SKILL' | 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION' | 'LICENSE' | 'OTHER';
    required: boolean;
    weight: number;
    evidenceTerms: string[];
};
export type WeightedTechnicalSkill = {
    name: string;
    required: boolean;
    weight: number;
    evidenceTerms: string[];
};
export type JobMatchProfile = {
    canonicalRole: string;
    occupationalFamily: string;
    occupationKeywords: string[];
    technicalSkills: WeightedTechnicalSkill[];
    requirements: WeightedJobRequirement[];
    softSkills: string[];
    summary: string;
};
export declare class JobMatchAiService {
    private readonly settings;
    constructor(settings: SettingsService);
    private isProvider;
    private config;
    private jsonCandidates;
    private parseJson;
    private rawGenerate;
    private generate;
    private strings;
    private specificOccupationKeywords;
    private weight;
    private normalizeProfile;
    normalizeProvidedProfile(raw: unknown): JobMatchProfile;
    analyze(job: Job): Promise<JobMatchProfile>;
}
