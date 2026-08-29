import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import { PaymentProviderConfigService } from './payment-provider-config.service';
export interface MercadoPagoPayerInput {
    name?: string;
    document?: string;
    documentType?: 'CPF' | 'CNPJ';
    email?: string;
}
export declare class MercadoPagoService {
    private readonly dataSource;
    private readonly payments;
    private readonly providerConfig;
    constructor(dataSource: DataSource, payments: PaymentsService, providerConfig: PaymentProviderConfigService);
    private config;
    private sdk;
    private assertConfigured;
    private webhookUrl;
    private returnUrl;
    private request;
    healthCheck(): Promise<{
        operational: boolean;
        message: string;
        details: {
            userId: any;
            nickname: any;
            webhookUrl: string;
            sdk: string;
            checkoutApi: string;
            recurringApi: string;
            capabilities: string[];
        };
    }>;
    private amount;
    private decimalToCents;
    private normalizePayerDocument;
    createImmediateCharge(amountCents: number, paymentId: string, productName: string, payer: MercadoPagoPayerInput): Promise<{
        provider: string;
        providerPaymentId: string;
        pixCopyPaste: any;
        qrCodeBase64: any;
        expiresAt: null;
        metadata: {
            mercadoPagoOrderId: string;
            mercadoPagoOrderStatus: any;
            mercadoPagoTransactionId: any;
            mercadoPagoTransactionStatus: any;
            mercadoPagoStatusDetail: any;
            ticketUrl: any;
            externalReference: string;
            checkoutApi: string;
            payerDocumentType: "CNPJ" | "CPF" | null;
        };
    }>;
    createRecurringCheckout(amountCents: number, paymentId: string, productName: string, payer: MercadoPagoPayerInput, trialDays?: number): Promise<{
        provider: string;
        providerPaymentId: string;
        pixCopyPaste: null;
        qrCodeBase64: null;
        expiresAt: null;
        metadata: {
            mercadoPagoSubscriptionId: string;
            mercadoPagoSubscriptionStatus: any;
            subscriptionCheckoutUrl: string;
            ticketUrl: string;
            externalReference: string;
            recurringApi: string;
            paymentType: string;
            requiresAuthorization: boolean;
            mercadoPagoTrialDays: number;
            mercadoPagoTrialStartDate: string | null;
        };
    }>;
    private validateSignature;
    private findPaymentByExternalReference;
    private handleOrder;
    private handleSubscription;
    private ensureAuthorizedPaymentRow;
    private handleAuthorizedPayment;
    private handleLegacyPayment;
    handleWebhook(body: any, query: Record<string, unknown>, headers: Record<string, string | string[] | undefined>): Promise<{
        ok: boolean;
        ignored: boolean;
        reason: string;
        dataId: string;
        paymentId?: undefined;
        status?: undefined;
    } | {
        ok: boolean;
        paymentId: any;
        status: any;
        ignored?: undefined;
        reason?: undefined;
        dataId?: undefined;
    } | {
        ok: boolean;
        ignored: boolean;
        reason: string;
        type: string;
        dataId?: undefined;
    } | {
        ok: boolean;
        ignored: boolean;
        type: string;
        dataId: string;
        reason?: undefined;
    }>;
}
