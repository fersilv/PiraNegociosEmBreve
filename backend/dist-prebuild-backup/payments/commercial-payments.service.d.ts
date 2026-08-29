import { DataSource } from 'typeorm';
import { BillingSupportService } from './billing-support.service';
import { PaymentCheckoutStatusService } from './payment-checkout-status.service';
import { PaymentProviderManagerService, type PaymentCheckoutPayer } from './payment-provider-manager.service';
import { PaymentsService } from './payments.service';
export type PurchaseMode = 'ONE_TIME' | 'SUBSCRIPTION';
export declare class CommercialPaymentsService {
    private readonly dataSource;
    private readonly payments;
    private readonly billingSupport;
    private readonly providers;
    private readonly checkoutStatus;
    private commercialProductSchemaReady;
    constructor(dataSource: DataSource, payments: PaymentsService, billingSupport: BillingSupportService, providers: PaymentProviderManagerService, checkoutStatus: PaymentCheckoutStatusService);
    private ensureCommercialProductSchema;
    private nullablePrice;
    private benefitArray;
    private normalizeMode;
    private promotionPrice;
    private present;
    listProducts(includeDisabled?: boolean): Promise<any>;
    getProduct(code: string, includeDisabled?: boolean): Promise<any>;
    updateProduct(code: string, input: Record<string, unknown>): Promise<any>;
    private chooseMode;
    createCheckout(userId: string, productCode: string, purchaseModeInput: unknown, payer?: PaymentCheckoutPayer): Promise<any>;
}
