import { Repository } from 'typeorm';
import { ApplicationsService } from '../applications/applications.service';
import { Application, ApplicationStatus } from '../applications/entities/application.entity';
import { CompanyCandidateNote } from '../companies/entities/company-candidate-note.entity';
import { CompanyTalentFolder } from '../companies/entities/company-talent-folder.entity';
import { CompanyTalentRecord } from '../companies/entities/company-talent-record.entity';
import { Company } from '../companies/entities/company.entity';
import { TalentInvitesService } from '../companies/talent-invites.service';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { CompanyPlansService } from './company-plans.service';
export declare class CompanyWhatsAppPremiumService {
    private readonly jobs;
    private readonly applications;
    private readonly users;
    private readonly folders;
    private readonly talentRecords;
    private readonly candidateNotes;
    private readonly appsService;
    private readonly talentInvites;
    private readonly plans;
    constructor(jobs: Repository<Job>, applications: Repository<Application>, users: Repository<User>, folders: Repository<CompanyTalentFolder>, talentRecords: Repository<CompanyTalentRecord>, candidateNotes: Repository<CompanyCandidateNote>, appsService: ApplicationsService, talentInvites: TalentInvitesService, plans: CompanyPlansService);
    private companyJob;
    private companyApplication;
    private parseStatus;
    private candidateName;
    setJobState(companyId: string, jobId: string, action: 'ACTIVATE' | 'DEACTIVATE' | 'CLOSE'): Promise<{
        id: string;
        title: string;
        active: boolean;
        deadlineDate: string | null;
        action: "ACTIVATE" | "DEACTIVATE" | "CLOSE";
    }>;
    listCandidates(companyId: string, jobId: string): Promise<{
        job: {
            id: string;
            title: string;
        };
        count: number;
        candidates: {
            applicationId: any;
            candidateId: any;
            status: any;
            priority: any;
            appliedAt: any;
            name: any;
            email: any;
            phone: any;
            city: any;
            state: any;
            skills: any;
            resumeStatus: any;
        }[];
    }>;
    candidateProfile(companyId: string, candidateId: string): Promise<{
        applicationId: string;
        candidate: {
            id: string;
            name: string;
            email: string;
            phone: string;
            additionalPhones: string[] | null;
            city: string | null;
            state: string | null;
            bio: string;
            experiences: unknown[] | null;
            education: unknown[] | null;
            skills: string[] | null;
            courses: unknown[] | null;
            languages: {
                name: string;
                level: string;
            }[] | null;
            linkedinURL: string;
            salaryExpectation: string | null;
            resumeURL: string;
            resumeStatus: "DRAFT" | "PUBLISHED";
            publishedResumeSnapshot: Record<string, unknown> | null;
        };
    }>;
    updateApplicationStatus(companyId: string, applicationId: string, statusInput: unknown, actor: {
        id: string;
        name: string;
    }): Promise<Application>;
    addApplicationNote(companyId: string, applicationId: string, note: string, actor: {
        id: string;
        name: string;
    }): Promise<Application>;
    inviteCandidate(company: Company, jobId: string, candidateId: string, actorId: string): Promise<{
        inviteId: string;
        candidateId: string;
        candidateName: string;
        jobId: string;
        jobTitle: string;
        status: string;
        delivery: {
            inviteUrl: string;
            status: "NOT_REQUESTED";
        } | {
            status: "SENT" | "NOT_CONFIGURED" | "FAILED";
            messageId?: string;
            error?: string;
            inviteUrl: string;
        };
    }>;
    cancelInvite(companyId: string, inviteId: string): Promise<{
        removed: boolean;
        inviteId: string;
    }>;
    listInvites(companyId: string): Promise<{
        id: string;
        candidateId: string | null;
        candidateEmail: string | null;
        candidateName: string | null;
        jobId: string;
        jobTitle: string;
        isInternal: boolean;
        status: string;
        emailStatus: string;
        emailSentAt: Date | null;
        viewedAt: Date | null;
        registeredAt: Date | null;
        acceptedAt: Date | null;
        declinedAt: Date | null;
        expiresAt: Date | null;
        createdAt: Date;
    }[]>;
    listTalentFolders(companyId: string): Promise<CompanyTalentFolder[]>;
    saveTalent(companyId: string, candidateId: string, folderIds?: string[], jobIds?: string[]): Promise<CompanyTalentRecord>;
    removeTalent(companyId: string, candidateId: string, folderId?: string): Promise<CompanyTalentRecord | {
        removed: boolean;
        candidateId?: undefined;
    } | {
        removed: boolean;
        candidateId: string;
    }>;
    addTalentNote(companyId: string, candidateId: string, actorId: string, note: string): Promise<CompanyCandidateNote>;
    private startOfWindow;
    recentApplications(companyId: string, window: string): Promise<{
        since: Date;
        count: number;
        applications: {
            applicationId: string;
            candidateId: string;
            candidateName: string;
            jobId: string;
            jobTitle: string;
            status: ApplicationStatus;
            createdAt: Date;
        }[];
    }>;
    jobStats(companyId: string, jobId?: string): Promise<{
        jobId: string;
        title: string;
        active: boolean;
        views: number;
        applications: any;
        newApplications24h: number;
        conversionPercent: number;
        byStatus: any;
        deadlineDate: string | null;
    }[]>;
    candidateWhatsAppTarget(companyId: string, candidateId: string): Promise<{
        candidateId: string;
        candidateName: string;
        chatId: string;
    }>;
}
