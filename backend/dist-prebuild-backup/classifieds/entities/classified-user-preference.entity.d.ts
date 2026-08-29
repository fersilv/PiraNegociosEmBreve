export type ClassifiedIdentityType = 'PERSONAL' | 'COMPANY';
export declare class ClassifiedUserPreference {
    userId: string;
    lastIdentityType: ClassifiedIdentityType | null;
    lastCompanyId: string | null;
    personalTermsVersion: string | null;
    personalTermsAcceptedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
