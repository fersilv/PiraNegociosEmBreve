export type ClassifiedPublicationChannel = 'CLASSIFIEDS' | 'COMPANY_PAGE';
export declare class CompanyClassifiedProfile {
    companyId: string;
    status: string;
    termsVersion: string | null;
    termsAcceptedAt: Date | null;
    termsAcceptedByUserId: string | null;
    businessSegments: string[];
    canSellProducts: boolean;
    canOfferServices: boolean;
    defaultPublicationChannels: ClassifiedPublicationChannel[];
    pageSectionLabel: string | null;
    createdAt: Date;
    updatedAt: Date;
}
