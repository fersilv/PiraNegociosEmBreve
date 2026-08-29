import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { CnpjLookupService } from './cnpj-lookup.service';
import { CompanyVerificationAuthorizationService } from './company-verification-authorization.service';
export declare class CompanyVerificationController {
    private readonly dataSource;
    private readonly cnpj;
    private readonly authorizations;
    constructor(dataSource: DataSource, cnpj: CnpjLookupService, authorizations: CompanyVerificationAuthorizationService);
    preview(cnpj: string): Promise<import("./cnpj-lookup.service").PublicCnpjSnapshot>;
    lookup(req: any, cnpj: string): Promise<{
        snapshot: import("./cnpj-lookup.service").PublicCnpjSnapshot;
        changes: {
            field: string;
            label: string;
            before: unknown;
            after: unknown;
        }[];
    }>;
    commercialProfile(req: any, body: Record<string, unknown>): Promise<any>;
    team(req: any): Promise<any>;
    teamPermissions(req: any, userId: string, body: Record<string, unknown>): Promise<any>;
    createAuthorization(req: any, body: Record<string, unknown>): Promise<any>;
    myAuthorizations(req: any): Promise<any>;
    private companyId;
    private membership;
    private primaryAdmin;
    private assertPermission;
    private cleanPermissions;
}
export declare class CompanyVerificationPublicController {
    private readonly authorizations;
    constructor(authorizations: CompanyVerificationAuthorizationService);
    info(token: string): Promise<{
        id: any;
        status: any;
        partnerName: any;
        partnerEmailMasked: string;
        partnerPhoneMasked: string;
        qsaQualification: any;
        grantFullPowers: boolean;
        permissions: any;
        expiresAt: any;
        selfieUploaded: boolean;
        consentVersion: string;
        company: {
            name: any;
            legalName: any;
            cnpj: any;
            registryTradeName: any;
            legalAddress: any;
            legalCity: any;
            legalState: any;
            cnpjSituation: any;
        } | null;
        requestedByName: any;
    }>;
    selfie(token: string, file: Express.Multer.File): Promise<{
        uploaded: boolean;
    }>;
    accept(token: string, body: Record<string, unknown>): Promise<any>;
}
export declare class CompanyVerificationAdminController {
    private readonly authorizations;
    constructor(authorizations: CompanyVerificationAuthorizationService);
    list(status?: string): Promise<any>;
    detail(id: string): Promise<any>;
    selfie(req: any, id: string, res: Response): Promise<void>;
    review(req: any, id: string, body: Record<string, unknown>): Promise<any>;
}
