import { DataSource, Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { ClassifiedIdentityType, ClassifiedUserPreference } from './entities/classified-user-preference.entity';
import { ClassifiedPublicationChannel, CompanyClassifiedProfile } from './entities/company-classified-profile.entity';
export declare const CLASSIFIEDS_TERMS_VERSION = "2026-08-25";
export type ActiveClassifiedIdentity = {
    type: ClassifiedIdentityType;
    user: User;
    company: Company | null;
    companyProfile: CompanyClassifiedProfile | null;
};
export declare class ClassifiedsIdentityService {
    private readonly preferences;
    private readonly companyProfiles;
    private readonly users;
    private readonly companies;
    private readonly dataSource;
    constructor(preferences: Repository<ClassifiedUserPreference>, companyProfiles: Repository<CompanyClassifiedProfile>, users: Repository<User>, companies: Repository<Company>, dataSource: DataSource);
    context(uid: string): Promise<{
        termsVersion: string;
        needsIdentitySelection: boolean;
        activeIdentity: ClassifiedIdentityType | null;
        personal: {
            available: boolean;
            termsAccepted: boolean;
            termsAcceptedAt: Date | null;
            name: string;
            photoURL: string | null;
        };
        company: {
            id: string;
            name: string;
            logoURL: string;
            available: boolean;
            verified: boolean;
            termsAccepted: boolean;
            requiresOnboarding: boolean;
            publishingSetupRequired: boolean;
            canSellProducts: boolean;
            canOfferServices: boolean;
            businessSegments: string[];
            defaultPublicationChannels: ClassifiedPublicationChannel[];
            pageSectionLabel: string | null;
        } | null;
    }>;
    select(uid: string, identityRaw: unknown): Promise<{
        termsVersion: string;
        needsIdentitySelection: boolean;
        activeIdentity: ClassifiedIdentityType | null;
        personal: {
            available: boolean;
            termsAccepted: boolean;
            termsAcceptedAt: Date | null;
            name: string;
            photoURL: string | null;
        };
        company: {
            id: string;
            name: string;
            logoURL: string;
            available: boolean;
            verified: boolean;
            termsAccepted: boolean;
            requiresOnboarding: boolean;
            publishingSetupRequired: boolean;
            canSellProducts: boolean;
            canOfferServices: boolean;
            businessSegments: string[];
            defaultPublicationChannels: ClassifiedPublicationChannel[];
            pageSectionLabel: string | null;
        } | null;
    }>;
    acceptPersonalTerms(uid: string, accepted: unknown): Promise<{
        termsVersion: string;
        needsIdentitySelection: boolean;
        activeIdentity: ClassifiedIdentityType | null;
        personal: {
            available: boolean;
            termsAccepted: boolean;
            termsAcceptedAt: Date | null;
            name: string;
            photoURL: string | null;
        };
        company: {
            id: string;
            name: string;
            logoURL: string;
            available: boolean;
            verified: boolean;
            termsAccepted: boolean;
            requiresOnboarding: boolean;
            publishingSetupRequired: boolean;
            canSellProducts: boolean;
            canOfferServices: boolean;
            businessSegments: string[];
            defaultPublicationChannels: ClassifiedPublicationChannel[];
            pageSectionLabel: string | null;
        } | null;
    }>;
    configureCompany(uid: string, body: Record<string, unknown>): Promise<{
        termsVersion: string;
        needsIdentitySelection: boolean;
        activeIdentity: ClassifiedIdentityType | null;
        personal: {
            available: boolean;
            termsAccepted: boolean;
            termsAcceptedAt: Date | null;
            name: string;
            photoURL: string | null;
        };
        company: {
            id: string;
            name: string;
            logoURL: string;
            available: boolean;
            verified: boolean;
            termsAccepted: boolean;
            requiresOnboarding: boolean;
            publishingSetupRequired: boolean;
            canSellProducts: boolean;
            canOfferServices: boolean;
            businessSegments: string[];
            defaultPublicationChannels: ClassifiedPublicationChannel[];
            pageSectionLabel: string | null;
        } | null;
    }>;
    active(uid: string, requireReady?: boolean): Promise<ActiveClassifiedIdentity>;
    assertPublishingReady(uid: string): Promise<ActiveClassifiedIdentity>;
    assertCompanyOperator(uid: string, companyId: string): Promise<{
        user: User;
        company: Company;
    }>;
    private baseContext;
    private membership;
}
