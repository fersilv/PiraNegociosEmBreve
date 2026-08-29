import { DataSource } from 'typeorm';
export declare class ClassifiedsCommerceAdminController {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    feeRules(): Promise<any>;
    savePlanRule(planRaw: string, body: Record<string, unknown>): Promise<{
        id: any;
        scope: any;
        plan: any;
        companyId: any;
        companyName: any;
        rateBps: number | null;
        percentage: number | null;
        minimumFeeCents: number;
        maximumFeeCents: number | null;
        enabled: boolean;
        updatedAt: any;
    }>;
    saveCompanyRule(companyId: string, body: Record<string, unknown>): Promise<{
        id: any;
        scope: any;
        plan: any;
        companyId: any;
        companyName: any;
        rateBps: number | null;
        percentage: number | null;
        minimumFeeCents: number;
        maximumFeeCents: number | null;
        enabled: boolean;
        updatedAt: any;
    }>;
    removeCompanyRule(companyId: string): Promise<{
        removed: boolean;
    }>;
    auctionFeeRules(): Promise<any>;
    saveAuctionPlanRule(planRaw: string, body: Record<string, unknown>): Promise<{
        id: any;
        scope: any;
        plan: any;
        companyId: any;
        companyName: any;
        rateBps: number | null;
        percentage: number | null;
        minimumFeeCents: number;
        maximumFeeCents: number | null;
        enabled: boolean;
        updatedAt: any;
    }>;
    saveAuctionCompanyRule(companyId: string, body: Record<string, unknown>): Promise<{
        id: any;
        scope: any;
        plan: any;
        companyId: any;
        companyName: any;
        rateBps: number | null;
        percentage: number | null;
        minimumFeeCents: number;
        maximumFeeCents: number | null;
        enabled: boolean;
        updatedAt: any;
    }>;
    removeAuctionCompanyRule(companyId: string): Promise<{
        removed: boolean;
    }>;
    companies(queryRaw?: string): Promise<any>;
    private listRules;
    private savePlan;
    private saveCompany;
    private removeCompany;
    private cleanRule;
    private plan;
    private cents;
    private presentRule;
}
