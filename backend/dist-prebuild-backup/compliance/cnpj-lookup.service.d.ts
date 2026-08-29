import { DataSource } from 'typeorm';
type QsaMember = {
    name: string;
    maskedDocument: string | null;
    qualification: string | null;
    joinedAt: string | null;
};
export type PublicCnpjSnapshot = {
    cnpj: string;
    legalName: string;
    tradeName: string | null;
    situation: string | null;
    legalAddress: string;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    email: string | null;
    phone: string | null;
    mainActivity: string | null;
    qsa: QsaMember[];
    source: 'BRASILAPI' | 'CNPJWS';
    sourceUpdatedAt: string | null;
    checkedAt: string;
};
export declare class CnpjLookupService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    lookup(raw: string): Promise<PublicCnpjSnapshot>;
    applyToCompany(companyId: string, snapshot: PublicCnpjSnapshot): Promise<{
        company: any;
        changes: {
            field: string;
            label: string;
            before: unknown;
            after: unknown;
        }[];
    }>;
    normalize(value: string): string;
    private fromBrasilApi;
    private fromCnpjWs;
    private detectImportantChanges;
    private joinAddress;
    private phone;
}
export {};
