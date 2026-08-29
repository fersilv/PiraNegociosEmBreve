import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
export declare const CLASSIFIEDS_PAYMENT_TERMS_VERSION = "2026-08-26";
export type ClassifiedPaymentTermsScope = 'ONLINE_PAYMENT_BUYER' | 'ONLINE_PAYMENT_SELLER';
export declare class ClassifiedsMarketplaceTermsService {
    private readonly dataSource;
    private readonly identities;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService);
    status(uid: string): Promise<{
        version: string;
        termsUrl: string;
        buyerAccepted: boolean;
        sellerAccepted: boolean;
        sellerAvailable: boolean;
        schemaReady: boolean;
        message: string;
    } | {
        version: string;
        termsUrl: string;
        buyerAccepted: boolean;
        sellerAccepted: boolean;
        sellerAvailable: boolean;
        schemaReady: boolean;
        message?: undefined;
    }>;
    accept(uid: string, rawScope: unknown, metadata?: Record<string, unknown>): Promise<{
        accepted: boolean;
        scope: ClassifiedPaymentTermsScope;
        version: string;
        acceptedAt: string;
    }>;
    assertAccepted(uid: string, scope: ClassifiedPaymentTermsScope): Promise<boolean>;
    private scope;
    private buyerKey;
    private sellerKey;
    private safeMetadata;
    private isTermsSchemaGap;
}
