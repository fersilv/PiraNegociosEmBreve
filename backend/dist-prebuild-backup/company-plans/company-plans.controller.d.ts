import type { PaymentCheckoutPayer } from '../payments/payment-provider-manager.service';
import type { PurchaseMode } from '../payments/commercial-payments.service';
import { CompanyPlanCommerceService } from './company-plan-commerce.service';
import { CompanyPlansOverviewService } from './company-plans-overview.service';
import { CompanyPlansService } from './company-plans.service';
export declare class CompanyPlansController {
    private readonly plans;
    private readonly overview;
    private readonly commerce;
    constructor(plans: CompanyPlansService, overview: CompanyPlansOverviewService, commerce: CompanyPlanCommerceService);
    getPlans(req: any): Promise<any>;
    latestCheckout(req: any): Promise<any>;
    checkout(req: any, body: {
        plan?: string;
        purchaseMode?: PurchaseMode;
        payer?: PaymentCheckoutPayer;
    }): Promise<any>;
    cancelAtPeriodEnd(req: any, body: {
        enabled?: boolean;
    }): Promise<any>;
}
