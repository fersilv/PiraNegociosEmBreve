import { JobMatchAdminService } from './job-match-admin.service';
import { JobMatchService } from './job-match.service';
export declare class JobMatchController {
    private readonly jobMatch;
    constructor(jobMatch: JobMatchService);
    status(req: any): Promise<{
        product: any;
        entitlement: any;
        lifetimeFree: boolean;
        active: boolean;
    }>;
    matches(req: any): Promise<{
        matches: any[];
        product: any;
        entitlement: any;
        lifetimeFree: boolean;
        active: boolean;
    }>;
    companyCandidates(req: any, jobId: string): Promise<{
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
    companyCandidateDetails(req: any, jobId: string, candidateIds: unknown): Promise<{
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
export declare class AdminJobMatchController {
    private readonly jobMatch;
    private readonly adminMatch;
    constructor(jobMatch: JobMatchService, adminMatch: JobMatchAdminService);
    overview(): Promise<any>;
    backfillQueue(limit?: string): Promise<any>;
    updateConfig(body: {
        durationDays?: unknown;
    }): Promise<any>;
    backfill(limit?: string): Promise<{
        processed: any;
        attempted: any;
        succeeded: number;
        failed: number;
        errors: {
            jobId: string;
            title: string;
            error: string | null;
        }[];
        overview: any;
    }>;
    prepareOne(id: string): Promise<{
        jobId: string;
        title: string;
        success: boolean;
        status: any;
        error: any;
    }>;
    reanalyze(id: string): Promise<any>;
}
