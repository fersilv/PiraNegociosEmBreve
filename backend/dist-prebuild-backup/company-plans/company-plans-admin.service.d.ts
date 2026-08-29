import { DataSource } from 'typeorm';
import { CompanyPlansService, type CompanyPlan } from './company-plans.service';
export declare class CompanyPlansAdminService {
    private readonly dataSource;
    private readonly companyPlans;
    constructor(dataSource: DataSource, companyPlans: CompanyPlansService);
    get(companyId: string): Promise<{
        company: {
            id: any;
            name: any;
        };
        current: {
            plan: CompanyPlan;
            basePlan: CompanyPlan;
            rank: number;
            active: boolean;
            status: any;
            currentPeriodStart: any;
            currentPeriodEnd: any;
            paidCurrentPeriodEnd: any;
            cancelAtPeriodEnd: boolean;
            provider: any;
            providerSubscriptionId: any;
            isSimulation: boolean;
            isTrial: boolean;
            trialEndsAt: any;
            trialTargetPlan: CompanyPlan | null;
            hasPaidSubscription: boolean;
            purchaseMode: "SUBSCRIPTION" | "ONE_TIME" | null;
            benefitIds: import("./company-plan-benefits").CompanyPlanBenefitId[];
            benefits: import("./company-plan-benefits").CompanyPlanBenefitDefinition[];
            advertisingEligible: boolean;
            jobHighlightEligible: boolean;
        };
        subscription: any;
        trial: any;
        plans: any[];
    }>;
    set(companyId: string, rawPlan: unknown, rawCurrentPeriodEnd: unknown, adminUserId: string): Promise<{
        company: {
            id: any;
            name: any;
        };
        current: {
            plan: CompanyPlan;
            basePlan: CompanyPlan;
            rank: number;
            active: boolean;
            status: any;
            currentPeriodStart: any;
            currentPeriodEnd: any;
            paidCurrentPeriodEnd: any;
            cancelAtPeriodEnd: boolean;
            provider: any;
            providerSubscriptionId: any;
            isSimulation: boolean;
            isTrial: boolean;
            trialEndsAt: any;
            trialTargetPlan: CompanyPlan | null;
            hasPaidSubscription: boolean;
            purchaseMode: "SUBSCRIPTION" | "ONE_TIME" | null;
            benefitIds: import("./company-plan-benefits").CompanyPlanBenefitId[];
            benefits: import("./company-plan-benefits").CompanyPlanBenefitDefinition[];
            advertisingEligible: boolean;
            jobHighlightEligible: boolean;
        };
        subscription: any;
        trial: any;
        plans: any[];
    }>;
    private plan;
    private periodEnd;
    private setHighlight;
}
