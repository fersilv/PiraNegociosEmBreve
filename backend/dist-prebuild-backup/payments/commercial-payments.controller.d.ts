import type { PaymentCheckoutPayer } from './payment-provider-manager.service';
import { CommercialPaymentsService, type PurchaseMode } from './commercial-payments.service';
export declare class CommercialPaymentsController {
    private readonly commercial;
    constructor(commercial: CommercialPaymentsService);
    catalog(): Promise<any>;
    checkout(req: any, body: {
        productCode?: string;
        purchaseMode?: PurchaseMode;
        payer?: PaymentCheckoutPayer;
    }): Promise<any>;
}
export declare class AdminCommercialPaymentsController {
    private readonly commercial;
    constructor(commercial: CommercialPaymentsService);
    list(): Promise<any>;
    update(code: string, body: Record<string, unknown>): Promise<any>;
}
