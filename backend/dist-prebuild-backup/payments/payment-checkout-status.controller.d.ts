import { PaymentCheckoutStatusService } from './payment-checkout-status.service';
export declare class PaymentCheckoutStatusController {
    private readonly statusService;
    constructor(statusService: PaymentCheckoutStatusService);
    status(req: any, paymentId: string): Promise<{
        id: any;
        paymentId: any;
        productCode: any;
        productName: any;
        productDescription: any;
        purchaseMode: string;
        billingType: string;
        amountCents: number;
        originalAmountCents: number;
        discountCents: number;
        status: any;
        provider: any;
        providerPaymentId: any;
        pixCopyPaste: any;
        qrCodeBase64: any;
        expiresAt: any;
        paidAt: any;
        checkoutReady: boolean;
        authorizationUrl: any;
        ticketUrl: any;
        recurring: boolean;
        subscriptionStatus: string | null;
        authorizationComplete: boolean;
        providerStatus: any;
        providerStatusDetail: any;
        completed: boolean;
        awaitingPayment: boolean;
        metadata: {
            purchaseMode: string;
            paymentType: string;
            checkoutApi: any;
            recurringApi: any;
            efiAutomaticPix: boolean;
        };
    }>;
}
