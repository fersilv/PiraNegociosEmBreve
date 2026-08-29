import { DataSource } from 'typeorm';
import { CommercialPaymentsService } from '../payments/commercial-payments.service';
import { PaymentCheckoutStatusService } from '../payments/payment-checkout-status.service';
import { PaymentProviderManagerService, type PaymentCheckoutPayer } from '../payments/payment-provider-manager.service';
import { PaymentsService } from '../payments/payments.service';
import { CompanyPlansService } from './company-plans.service';
export declare class CompanyPlanCommerceService {
    private readonly dataSource;
    private readonly plans;
    private readonly commercial;
    private readonly payments;
    private readonly providers;
    private readonly checkoutStatus;
    constructor(dataSource: DataSource, plans: CompanyPlansService, commercial: CommercialPaymentsService, payments: PaymentsService, providers: PaymentProviderManagerService, checkoutStatus: PaymentCheckoutStatusService);
    private normalizePlan;
    private normalizeMode;
    private metadataObject;
    private currentAccessMode;
    enrichOverview(payload: any): Promise<any>;
    createCheckout(userId: string, requestedPlan: unknown, purchaseModeInput: unknown, payer?: PaymentCheckoutPayer): Promise<any>;
}
