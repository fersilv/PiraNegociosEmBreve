import { Repository } from 'typeorm';
import { AiService } from './ai.service';
import { JobSkillsService } from './job-skills.service';
import { ResumeImportService, type ResumeSourceDocumentInput } from './resume-import.service';
import { ResumeReviewService } from './resume-review.service';
import { ResumeImprovementService, type ResumeImprovementProposal } from './resume-improvement.service';
import { User } from '../users/entities/user.entity';
import { PaymentsService } from '../payments/payments.service';
import { BillingSupportService } from '../payments/billing-support.service';
export declare class AiController {
    private readonly aiService;
    private readonly jobSkillsService;
    private readonly resumeImportService;
    private readonly resumeReviewService;
    private readonly resumeImprovementService;
    private readonly paymentsService;
    private readonly billingSupport;
    private readonly usersRepository;
    constructor(aiService: AiService, jobSkillsService: JobSkillsService, resumeImportService: ResumeImportService, resumeReviewService: ResumeReviewService, resumeImprovementService: ResumeImprovementService, paymentsService: PaymentsService, billingSupport: BillingSupportService, usersRepository: Repository<User>);
    private requireUser;
    getStatus(req: any): Promise<{
        lifetimeFree: boolean;
        devMode: boolean;
        paymentAccessOverride: boolean;
        resumeScorePaymentRequired: boolean;
        resumeReanalysisPaymentRequired: boolean;
        resumeImprovementPaymentRequired: boolean;
        resumeImportPaymentRequired: boolean;
        freeResumeAnalysisAvailable: boolean;
        freeResumeImportAvailable: boolean;
        hasSavedResumeAnalysis: boolean;
        resumeAnalysisCount: number;
        resumeImportCount: number;
        credits: Record<string, number>;
        products: {
            reanalysis: any;
            improvement: any;
            import: any;
        };
        availability: {
            reanalysis: boolean;
            improvement: boolean;
            import: boolean;
        };
        enabled: boolean;
        provider: ("GEMINI" | "OPENAI" | "GROQ") | null;
        model: string | null;
    }>;
    private runResumeImport;
    analyzeResume(req: any, body: {
        base64File: string;
        mimeType: string;
    }): Promise<{
        documentsProcessed: number;
    }>;
    analyzeResumeDocuments(req: any, body: {
        documents?: ResumeSourceDocumentInput[];
    }): Promise<{
        documentsProcessed: number;
    }>;
    reviewResume(req: any, body: {
        profile?: unknown;
    }): Promise<import("./resume-review.service").ResumeReviewResult>;
    improveResume(req: any): Promise<{
        id: any;
        status: any;
        proposal: ResumeImprovementProposal;
    }>;
    applyResumeImprovement(req: any, id: string, body: {
        selectedChangeIds?: string[];
    }): Promise<{
        applied: boolean;
        partial: boolean;
        selectedChangeIds: string[];
        analysis: any;
        analysisError: string | null;
    }>;
    suggestJobSkills(body: {
        title?: string;
        description?: string;
        requirements?: string;
    }): Promise<{
        skills: string[];
    }>;
    skillCompatibility(body: {
        candidateSkills?: unknown;
        jobSkills?: unknown;
    }): Promise<import("./job-skills.service").SkillCompatibilityResult>;
    jobMatch(body: {
        profile?: unknown;
        jobs?: unknown[];
        applications?: unknown[];
    }): Promise<{
        matches: any[];
    }>;
}
