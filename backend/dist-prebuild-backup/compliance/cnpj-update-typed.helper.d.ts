import { DataSource } from 'typeorm';
export declare function applyTypedCnpjCompanyUpdate(dataSource: DataSource, companyId: string, input: {
    cnpj: string;
    legalName: string;
    tradeName: string | null;
    legalAddress: string;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    situation: string | null;
    source: string;
    sourceUpdatedAt: string | null;
    snapshot: string;
    changeAlert: string;
    commercialSame: boolean;
}): Promise<any>;
