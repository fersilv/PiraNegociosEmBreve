import { DataSource } from 'typeorm';
import { CompanyVerificationEmailService } from './company-verification-email.service';
export declare class CompanyVerificationAuthorizationService {
    private readonly dataSource;
    private readonly email;
    constructor(dataSource: DataSource, email: CompanyVerificationEmailService);
    create(uid: string, body: Record<string, unknown>): Promise<any>;
    publicInfo(token: string): Promise<{
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
    uploadSelfie(token: string, file: Express.Multer.File): Promise<{
        uploaded: boolean;
    }>;
    accept(token: string, body: Record<string, unknown>): Promise<any>;
    adminList(statusRaw?: string): Promise<any>;
    adminDetail(id: string): Promise<any>;
    adminSelfie(id: string, actorUid?: string, ip?: string): Promise<{
        buffer: Buffer<ArrayBufferLike>;
        mimeType: any;
        originalName: any;
    }>;
    adminReview(actorUid: string, id: string, body: Record<string, unknown>): Promise<any>;
    private byToken;
    private assertUsable;
    private expireIfNeeded;
    private primaryAdmin;
    private permissions;
    private normalizeName;
    private maskEmail;
    private maskPhone;
    private vaultDir;
    private encryptionKey;
}
