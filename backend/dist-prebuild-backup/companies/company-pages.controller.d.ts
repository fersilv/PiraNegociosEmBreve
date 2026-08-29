import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Company } from './entities/company.entity';
import { CompanyPagesService } from './company-pages.service';
export declare class CompanyPagesController {
    private readonly companyPages;
    private readonly companies;
    private readonly users;
    constructor(companyPages: CompanyPagesService, companies: Repository<Company>, users: Repository<User>);
    private assertManager;
    getPage(req: any, id: string): Promise<{
        access: {
            requiresVerifiedCompany: boolean;
            advancedEditor: {
                product: string;
                requiresPlus: boolean;
                testMode: boolean;
                allowed: boolean;
            };
        };
        draft: {
            [x: string]: any;
        };
        validation: {
            editorMode: string;
            validForPublish: boolean;
            missingSections: string[];
            missingCodeComponents: string[];
            missingCompanyData: string[];
            warnings: string[];
            lockedComponents: string[];
            requiredCodeTags: ("pn-company-name" | "pn-company-address" | "pn-verification-badge")[];
        };
        companyId: string;
        templateKey: string;
        published: Record<string, unknown> | null;
        status: "DRAFT" | "PUBLISHED";
        revision: number;
        publishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    } | {
        access: {
            requiresVerifiedCompany: boolean;
            advancedEditor: {
                product: string;
                requiresPlus: boolean;
                testMode: boolean;
                allowed: boolean;
            };
        };
        companyId: string;
        templateKey: string;
        draft: {
            [x: string]: any;
        };
        published: null;
        status: "DRAFT";
        revision: number;
        publishedAt: null;
        validation: {
            editorMode: string;
            validForPublish: boolean;
            missingSections: string[];
            missingCodeComponents: string[];
            missingCompanyData: string[];
            warnings: string[];
            lockedComponents: string[];
            requiredCodeTags: ("pn-company-name" | "pn-company-address" | "pn-verification-badge")[];
        };
    }>;
    saveDraft(req: any, id: string, body: {
        config?: unknown;
    }): Promise<{
        validation: {
            editorMode: string;
            validForPublish: boolean;
            missingSections: string[];
            missingCodeComponents: string[];
            missingCompanyData: string[];
            warnings: string[];
            lockedComponents: string[];
            requiredCodeTags: ("pn-company-name" | "pn-company-address" | "pn-verification-badge")[];
        };
        companyId: string;
        templateKey: string;
        draft: Record<string, unknown>;
        published: Record<string, unknown> | null;
        status: "DRAFT" | "PUBLISHED";
        revision: number;
        publishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createPreview(req: any, id: string, body: {
        config?: unknown;
    }): Promise<{
        url: string;
        token: string;
        expiresAt: Date;
        validation: {
            editorMode: string;
            validForPublish: boolean;
            missingSections: string[];
            missingCodeComponents: string[];
            missingCompanyData: string[];
            warnings: string[];
            lockedComponents: string[];
            requiredCodeTags: ("pn-company-name" | "pn-company-address" | "pn-verification-badge")[];
        };
    }>;
    publish(req: any, id: string, body: {
        config?: unknown;
    }): Promise<{
        validation: {
            editorMode: string;
            validForPublish: boolean;
            missingSections: string[];
            missingCodeComponents: string[];
            missingCompanyData: string[];
            warnings: string[];
            lockedComponents: string[];
            requiredCodeTags: ("pn-company-name" | "pn-company-address" | "pn-verification-badge")[];
        };
        companyId: string;
        templateKey: string;
        draft: Record<string, unknown>;
        published: Record<string, unknown> | null;
        status: "DRAFT" | "PUBLISHED";
        revision: number;
        publishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    unpublish(req: any, id: string): Promise<import("./entities/company-page.entity").CompanyPage | null>;
}
