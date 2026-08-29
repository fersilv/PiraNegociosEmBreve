import { DataSource, Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { PaymentsService } from '../payments/payments.service';
import { BillingSupportService } from '../payments/billing-support.service';
import { JobMatchAiService } from './job-match-ai.service';
export declare const JOB_MATCH_ALGORITHM_VERSION = "job-match-v2";
export declare class JobMatchService {
    private readonly jobs;
    private readonly users;
    private readonly dataSource;
    private readonly ai;
    private readonly payments;
    private readonly billingSupport;
    private readonly stagedProvidedProfiles;
    constructor(jobs: Repository<Job>, users: Repository<User>, dataSource: DataSource, ai: JobMatchAiService, payments: PaymentsService, billingSupport: BillingSupportService);
    private normalize;
    private tokens;
    private hash;
    private jobFingerprint;
    private resumeFingerprint;
    stageProvidedProfile(jobId: string, rawProfile: unknown): void;
    clearStagedProvidedProfile(jobId: string): void;
    private storeProvidedProfile;
    acceptProvidedProfile(jobId: string, rawProfile: unknown): Promise<{
        accepted: boolean;
        source: string;
        profile: any;
        reason?: undefined;
    } | {
        accepted: boolean;
        source: string;
        reason: string;
        profile?: undefined;
    }>;
    analyzeActiveJob(job: Job, force?: boolean): Promise<any>;
    reanalyzeJob(jobId: string): Promise<any>;
    private candidateData;
    private phraseScore;
    private bestEvidence;
    private requirementScore;
    private locationScore;
    private scoreJob;
    private cachedScoreForUserJob;
    private rankCompanyExposure;
    getStatus(userId: string): Promise<{
        product: any;
        entitlement: any;
        lifetimeFree: boolean;
        active: boolean;
    }>;
    getMatches(userId: string): Promise<{
        matches: any[];
        product: any;
        entitlement: any;
        lifetimeFree: boolean;
        active: boolean;
    }>;
    getEarlyAlertRecipientsForJob(jobId: string): Promise<string[]>;
    getCompanyCandidatesForJob(requestingUserId: string, jobId: string, requestedCandidateIds?: string[]): Promise<{
        jobId: string;
        preparing: boolean;
        candidates: never[];
        rankingRule?: undefined;
    } | {
        jobId: string;
        preparing: boolean;
        rankingRule: string;
        candidates: {
            candidateId: string;
            score: number;
            boosted: boolean;
            reason: string;
            evidence: string[];
            missingRequirements: string[];
            confidence: string;
            occupationalScore: number;
            technicalScore: number;
            experienceScore: number;
            educationScore: number;
            preferenceScore: number;
        }[];
    }>;
}
