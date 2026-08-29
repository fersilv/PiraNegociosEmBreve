import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import { PaymentProviderConfigService } from './payment-provider-config.service';
export interface EfiPayerInput {
    name?: string;
    document?: string;
    email?: string;
}
export declare class EfiPixService {
    private readonly dataSource;
    private readonly payments;
    private readonly providerConfig;
    private token;
    constructor(dataSource: DataSource, payments: PaymentsService, providerConfig: PaymentProviderConfigService);
    private config;
    private sandbox;
    private automaticEnabled;
    private baseUrl;
    private assertConfigured;
    private certificate;
    private agent;
    private receiverAccount;
    private rawRequest;
    private accessToken;
    private api;
    healthCheck(): Promise<{
        operational: boolean;
        message: string;
        details: {
            environment: string;
            certificateFileName: string | null;
            pixAutomaticEnabled: boolean;
            webhookReady: boolean;
        };
    }>;
    private amount;
    private cleanDocument;
    private expirationSeconds;
    private parseMetadata;
    private addCalendarDays;
    private addCalendarMonths;
    private initialRecurringDate;
    private automaticTxid;
    createImmediateCharge(amountCents: number, paymentId: string, productName: string): Promise<{
        provider: string;
        providerPaymentId: string;
        pixCopyPaste: string | null;
        qrCodeBase64: string | null;
        expiresAt: Date;
        metadata: {
            efiStatus: string | null;
            efiLocationId: number | null;
            efiLocation: string | null;
            efiPaymentLink: string | null;
            efiSandbox: boolean;
        };
    }>;
    createMonthlyAutomaticCharge(amountCents: number, paymentId: string, productName: string, payer: EfiPayerInput, trialDays?: number): Promise<{
        provider: string;
        providerPaymentId: string;
        pixCopyPaste: string | null;
        qrCodeBase64: null;
        expiresAt: null;
        metadata: {
            efiAutomaticPix: boolean;
            efiJourney: string;
            efiRecurrenceId: string;
            efiRecurrenceStatus: string;
            efiRecurrenceLocationId: number;
            efiRecurrenceLocation: string | null;
            efiNextChargeDate: string;
            efiTrialDays: number;
            requiresAuthorization: boolean;
            efiSandbox: boolean;
        };
    } | {
        provider: string;
        providerPaymentId: string;
        pixCopyPaste: string | null;
        qrCodeBase64: null;
        expiresAt: Date;
        metadata: {
            efiAutomaticPix: boolean;
            efiRecurrenceId: string;
            efiRecurrenceStatus: string;
            efiRecurrenceLocationId: number;
            efiRecurrenceLocation: string | null;
            efiNextChargeDate: string;
            efiSandbox: boolean;
            efiJourney?: undefined;
            efiTrialDays?: undefined;
            requiresAuthorization?: undefined;
        };
    }>;
    private webhookUrl;
    private webhookError;
    configureWebhooks(paymentType?: 'PIX' | 'PIX_AUTOMATICO'): Promise<{
        webhookUrl: string;
        pix: any;
        recurrence: any;
        recurringCharges: any;
        automaticEnabled: boolean;
        paymentType: "PIX" | "PIX_AUTOMATICO";
    }>;
    private validateWebhookSecret;
    private decimalToCents;
    private syncSubscriptionForRecurrence;
    private markRecurrenceStatus;
    private createAutomaticProviderCharge;
    private ensureNextAutomaticCharge;
    handlePixWebhook(body: any, hmac?: string): Promise<{
        ok: boolean;
        processed: number;
        results: any[];
    }>;
    handleAutomaticRecurrenceWebhook(body: any, hmac?: string): Promise<{
        ok: boolean;
        processed: number;
        updated: any[];
    }>;
    handleAutomaticChargeWebhook(body: any, hmac?: string): Promise<{
        ok: boolean;
        processed: number;
        results: any[];
    }>;
}
