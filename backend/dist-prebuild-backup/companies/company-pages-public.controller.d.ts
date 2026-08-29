import { Repository } from 'typeorm';
import { Company, CompanyStatus } from './entities/company.entity';
import { CompanyPage } from './entities/company-page.entity';
import { CompanyPagePreview } from './entities/company-page-preview.entity';
import { Job } from '../jobs/entities/job.entity';
export declare class CompanyPagesPublicController {
    private readonly companies;
    private readonly pages;
    private readonly previews;
    private readonly jobs;
    constructor(companies: Repository<Company>, pages: Repository<CompanyPage>, previews: Repository<CompanyPagePreview>, jobs: Repository<Job>);
    published(companyId: string): Promise<{
        page: null;
        templateKey?: undefined;
        revision?: undefined;
        publishedAt?: undefined;
    } | {
        page: Record<string, unknown>;
        templateKey: string;
        revision: number;
        publishedAt: Date | null;
    }>;
    preview(token: string): Promise<{
        preview: boolean;
        expiresAt: Date;
        page: Record<string, unknown>;
        company: {
            id: string;
            name: string;
            slug: string | null;
            description: string;
            website: string;
            address: string;
            cityState: string | null;
            city: string | null;
            state: string | null;
            phone: string;
            logoURL: string;
            socialInstagram: string;
            socialLinkedin: string;
            socialFacebook: string;
            isVerified: boolean;
            verificationStatus: CompanyStatus;
        };
        jobs: {
            id: string;
            slug: string | null;
            title: string;
            location: string;
            city: string | null;
            state: string | null;
            type: string;
            workModel: string;
            salary: string | null;
        }[];
    }>;
}
