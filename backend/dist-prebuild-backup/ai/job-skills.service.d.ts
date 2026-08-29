import { SettingsService } from '../admin/settings.service';
export interface SkillCompatibilityMatch {
    jobSkill: string;
    candidateSkill: string;
    score: number;
}
export interface SkillCompatibilityResult {
    score: number;
    matches: SkillCompatibilityMatch[];
}
export interface JobSkillScore extends SkillCompatibilityResult {
    jobId: string;
}
export interface JobSkillScoresResult {
    scores: JobSkillScore[];
}
export declare class JobSkillsService {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    private isProvider;
    private getRuntimeConfig;
    private parseJson;
    private buildInstruction;
    private generateJson;
    private normalizeSkills;
    private collectCandidateSkills;
    private normalizeMatches;
    suggestSkills(title: string, description: string, requirements?: string): Promise<{
        skills: string[];
    }>;
    scoreCompatibility(candidateSkills: unknown, jobSkills: unknown): Promise<SkillCompatibilityResult>;
    scoreJobs(profile: unknown, jobs: unknown[]): Promise<JobSkillScoresResult>;
}
