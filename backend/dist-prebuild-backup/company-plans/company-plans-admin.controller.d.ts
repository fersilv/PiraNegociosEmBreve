import { CompanyPlansAdminService } from './company-plans-admin.service';
import { CompanyPlansService } from './company-plans.service';
export declare class CompanyPlansAdminController {
    private readonly adminPlans;
    private readonly plans;
    constructor(adminPlans: CompanyPlansAdminService, plans: CompanyPlansService);
    benefitCatalog(): {
        plan: import("./company-plan-benefits").PaidCompanyPlan;
        benefits: import("./company-plan-benefits").CompanyPlanBenefitDefinition[];
        defaultBenefitIds: import("./company-plan-benefits").CompanyPlanBenefitId[];
        PLUS?: undefined;
        ELITE?: undefined;
    } | {
        PLUS: {
            benefits: import("./company-plan-benefits").CompanyPlanBenefitDefinition[];
            defaultBenefitIds: import("./company-plan-benefits").CompanyPlanBenefitId[];
        };
        ELITE: {
            benefits: import("./company-plan-benefits").CompanyPlanBenefitDefinition[];
            defaultBenefitIds: import("./company-plan-benefits").CompanyPlanBenefitId[];
        };
        plan?: undefined;
        benefits?: undefined;
        defaultBenefitIds?: undefined;
    };
    get(companyId: string): Promise<{
        company: {
            id: any;
            name: any;
        };
        current: {
            plan: import("./company-plans.service").CompanyPlan;
            basePlan: import("./company-plans.service").CompanyPlan;
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
            trialTargetPlan: import("./company-plans.service").CompanyPlan | null;
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
    set(req: any, companyId: string, body: {
        plan?: string;
        currentPeriodEnd?: string | null;
    }): Promise<{
        company: {
            id: any;
            name: any;
        };
        current: {
            plan: import("./company-plans.service").CompanyPlan;
            basePlan: import("./company-plans.service").CompanyPlan;
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
            trialTargetPlan: import("./company-plans.service").CompanyPlan | null;
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
}
