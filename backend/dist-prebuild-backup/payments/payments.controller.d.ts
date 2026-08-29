import { PaymentsService, type FeatureCredit } from './payments.service';
import { BillingSupportService, type TimedFeature } from './billing-support.service';
import { ProductDurationService } from './product-duration.service';
import { EfiPixService } from './efi-pix.service';
import { MercadoPagoService } from './mercado-pago.service';
import { MercadoPagoTestLabService } from './mercado-pago-test-lab.service';
import { PaymentCheckoutStatusService } from './payment-checkout-status.service';
import { PaymentProviderManagerService, type PaymentCheckoutPayer } from './payment-provider-manager.service';
export declare class PaymentsController {
    private readonly payments;
    private readonly billingSupport;
    private readonly providers;
    private readonly checkoutStatus;
    constructor(payments: PaymentsService, billingSupport: BillingSupportService, providers: PaymentProviderManagerService, checkoutStatus: PaymentCheckoutStatusService);
    getCatalog(): Promise<any>;
    getPaymentRoutes(): Promise<any>;
    getMine(req: any): Promise<any>;
    getMyCredits(req: any): Promise<Record<string, number>>;
    getMyBillingStatus(req: any): Promise<{
        lifetimeFree: boolean;
        isOpenToWork: boolean;
        resumeStatus: any;
        credits: Record<string, number>;
        entitlements: any;
        subscriptions: any;
    }>;
    createPix(req: any, body: {
        productCode?: string;
        payer?: PaymentCheckoutPayer;
    }): Promise<any>;
    getResumeHistory(req: any): Promise<{
        analyses: any;
        improvements: any;
        publications: any;
    }>;
}
export declare class EfiPaymentsWebhookController {
    private readonly efiPix;
    constructor(efiPix: EfiPixService);
    receive(body: any, hmac?: string): Promise<{
        ok: boolean;
        processed: number;
        results: any[];
    } | {
        ok: boolean;
        processed: number;
        updated: any[];
    } | {
        ok: boolean;
        test: boolean;
    }>;
}
export declare class MercadoPagoPaymentsWebhookController {
    private readonly mercadoPago;
    constructor(mercadoPago: MercadoPagoService);
    receive(body: any, query: Record<string, unknown>, headers: Record<string, string | string[] | undefined>): Promise<{
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
export declare class AdminPaymentsController {
    private readonly payments;
    private readonly billingSupport;
    private readonly productDuration;
    private readonly providers;
    private readonly mercadoPagoTests;
    constructor(payments: PaymentsService, billingSupport: BillingSupportService, productDuration: ProductDurationService, providers: PaymentProviderManagerService, mercadoPagoTests: MercadoPagoTestLabService);
    getDevMode(): Promise<{
        enabled: boolean;
    }>;
    setDevMode(body: {
        enabled?: boolean;
    }): Promise<{
        enabled: boolean;
    }>;
    mercadoPagoTestOverview(): Promise<{
        provider: string;
        environment: string;
        productionCredentialsUntouched: boolean;
        profiles: Record<string, any>;
        history: any;
        vault: {
            encryptedAtRest: boolean;
            algorithm: string;
            keyStorage: string;
            keyPathHint: string;
        };
    }>;
    saveMercadoPagoTestProfile(req: any, profile: string, body: Record<string, unknown>): Promise<{
        profile: "ORDERS" | "SUBSCRIPTIONS" | "MARKETPLACE";
        applicationId: string | null;
        publicKeyConfigured: boolean;
        accessTokenConfigured: boolean;
        sellerAccessTokenConfigured: boolean;
        payerEmail: string;
        updatedAt: string | null;
    }>;
    testMercadoPagoCredentials(req: any, profile: string): Promise<{
        ok: boolean;
        profile: "ORDERS" | "SUBSCRIPTIONS" | "MARKETPLACE";
        userId: any;
        nickname: any;
        applicationId: string | null;
    }>;
    createMercadoPagoTestOrder(req: any): Promise<{
        ok: boolean;
        profile: "ORDERS";
        orderId: string;
        transactionId: any;
        status: any;
        statusDetail: any;
        transactionStatus: any;
        transactionStatusDetail: any;
        externalReference: string;
        amount: string;
        payerEmail: string;
        certificationScenario: string;
    }>;
    getMercadoPagoTestOrder(req: any, orderId: string): Promise<{
        orderId: string;
        status: any;
        totalAmount: any;
        externalReference: any;
        transactionId: any;
        transactionStatus: any;
        transactionStatusDetail: any;
    }>;
    createMercadoPagoTestSubscription(req: any): Promise<{
        ok: boolean;
        profile: "SUBSCRIPTIONS";
        preapprovalId: string;
        status: any;
        initPoint: any;
        externalReference: string;
        payerEmail: string;
    }>;
    getMercadoPagoTestSubscription(req: any, preapprovalId: string): Promise<{
        preapprovalId: string;
        status: any;
        payerEmail: any;
        nextPaymentDate: any;
        externalReference: any;
        initPoint: any;
    }>;
    createMercadoPagoTestSplit(req: any): Promise<{
        ok: boolean;
        profile: "MARKETPLACE";
        paymentId: string;
        status: any;
        statusDetail: any;
        externalReference: string;
        transactionAmount: number;
        intermediationFee: number;
        payerEmail: string;
    }>;
    getMercadoPagoTestSplit(req: any, paymentId: string): Promise<{
        paymentId: string;
        status: any;
        statusDetail: any;
        transactionAmount: any;
        applicationFee: any;
        externalReference: any;
    }>;
    getProviders(): Promise<any[]>;
    getProviderRoutes(): Promise<any>;
    getProviderVaultStatus(): {
        encryptedAtRest: boolean;
        algorithm: string;
        keyStorage: string;
        keyPathHint: string;
    };
    getProvider(code: string): Promise<{
        code: import("./payment-provider-config.service").PaymentProviderCode;
        name: any;
        description: any;
        active: boolean;
        activeFor: any;
        configured: boolean;
        configVersion: number;
        lastHealthCheckAt: any;
        lastHealthCheckOk: any;
        lastHealthCheckMessage: any;
        lastHealthCheckDetails: any;
        activatedAt: any;
        updatedAt: any;
        config: {
            environment: string;
            clientIdConfigured: boolean;
            clientSecretConfigured: boolean;
            pixKeyConfigured: boolean;
            certificateConfigured: boolean;
            certificateFileName: any;
            certificateHasPassphrase: boolean;
            pixAutomaticEnabled: boolean;
            receiverAccountConfigured: boolean;
            publicApiBaseUrl: any;
            skipMtlsChecking: boolean;
            capabilities: string[];
            accessTokenConfigured?: undefined;
            publicKeyConfigured?: undefined;
            webhookSecretConfigured?: undefined;
            marketplaceClientIdConfigured?: undefined;
            marketplaceClientId?: undefined;
            marketplaceClientSecretConfigured?: undefined;
            marketplaceRedirectUri?: undefined;
            checkoutApi?: undefined;
            recurringApi?: undefined;
            sdk?: undefined;
        } | {
            environment: string;
            accessTokenConfigured: boolean;
            publicKeyConfigured: boolean;
            webhookSecretConfigured: boolean;
            marketplaceClientIdConfigured: boolean;
            marketplaceClientId: any;
            marketplaceClientSecretConfigured: boolean;
            marketplaceRedirectUri: any;
            publicApiBaseUrl: any;
            capabilities: string[];
            checkoutApi: string;
            recurringApi: string;
            sdk: string;
            clientIdConfigured?: undefined;
            clientSecretConfigured?: undefined;
            pixKeyConfigured?: undefined;
            certificateConfigured?: undefined;
            certificateFileName?: undefined;
            certificateHasPassphrase?: undefined;
            pixAutomaticEnabled?: undefined;
            receiverAccountConfigured?: undefined;
            skipMtlsChecking?: undefined;
        };
    }>;
    saveProvider(req: any, code: string, body: Record<string, unknown>): Promise<{
        code: import("./payment-provider-config.service").PaymentProviderCode;
        name: any;
        description: any;
        active: boolean;
        activeFor: any;
        configured: boolean;
        configVersion: number;
        lastHealthCheckAt: any;
        lastHealthCheckOk: any;
        lastHealthCheckMessage: any;
        lastHealthCheckDetails: any;
        activatedAt: any;
        updatedAt: any;
        config: {
            environment: string;
            clientIdConfigured: boolean;
            clientSecretConfigured: boolean;
            pixKeyConfigured: boolean;
            certificateConfigured: boolean;
            certificateFileName: any;
            certificateHasPassphrase: boolean;
            pixAutomaticEnabled: boolean;
            receiverAccountConfigured: boolean;
            publicApiBaseUrl: any;
            skipMtlsChecking: boolean;
            capabilities: string[];
            accessTokenConfigured?: undefined;
            publicKeyConfigured?: undefined;
            webhookSecretConfigured?: undefined;
            marketplaceClientIdConfigured?: undefined;
            marketplaceClientId?: undefined;
            marketplaceClientSecretConfigured?: undefined;
            marketplaceRedirectUri?: undefined;
            checkoutApi?: undefined;
            recurringApi?: undefined;
            sdk?: undefined;
        } | {
            environment: string;
            accessTokenConfigured: boolean;
            publicKeyConfigured: boolean;
            webhookSecretConfigured: boolean;
            marketplaceClientIdConfigured: boolean;
            marketplaceClientId: any;
            marketplaceClientSecretConfigured: boolean;
            marketplaceRedirectUri: any;
            publicApiBaseUrl: any;
            capabilities: string[];
            checkoutApi: string;
            recurringApi: string;
            sdk: string;
            clientIdConfigured?: undefined;
            clientSecretConfigured?: undefined;
            pixKeyConfigured?: undefined;
            certificateConfigured?: undefined;
            certificateFileName?: undefined;
            certificateHasPassphrase?: undefined;
            pixAutomaticEnabled?: undefined;
            receiverAccountConfigured?: undefined;
            skipMtlsChecking?: undefined;
        };
    }>;
    testProvider(req: any, code: string): Promise<{
        code: import("./payment-provider-config.service").PaymentProviderCode;
        name: any;
        description: any;
        active: boolean;
        activeFor: any;
        configured: boolean;
        configVersion: number;
        lastHealthCheckAt: any;
        lastHealthCheckOk: any;
        lastHealthCheckMessage: any;
        lastHealthCheckDetails: any;
        activatedAt: any;
        updatedAt: any;
        config: {
            environment: string;
            clientIdConfigured: boolean;
            clientSecretConfigured: boolean;
            pixKeyConfigured: boolean;
            certificateConfigured: boolean;
            certificateFileName: any;
            certificateHasPassphrase: boolean;
            pixAutomaticEnabled: boolean;
            receiverAccountConfigured: boolean;
            publicApiBaseUrl: any;
            skipMtlsChecking: boolean;
            capabilities: string[];
            accessTokenConfigured?: undefined;
            publicKeyConfigured?: undefined;
            webhookSecretConfigured?: undefined;
            marketplaceClientIdConfigured?: undefined;
            marketplaceClientId?: undefined;
            marketplaceClientSecretConfigured?: undefined;
            marketplaceRedirectUri?: undefined;
            checkoutApi?: undefined;
            recurringApi?: undefined;
            sdk?: undefined;
        } | {
            environment: string;
            accessTokenConfigured: boolean;
            publicKeyConfigured: boolean;
            webhookSecretConfigured: boolean;
            marketplaceClientIdConfigured: boolean;
            marketplaceClientId: any;
            marketplaceClientSecretConfigured: boolean;
            marketplaceRedirectUri: any;
            publicApiBaseUrl: any;
            capabilities: string[];
            checkoutApi: string;
            recurringApi: string;
            sdk: string;
            clientIdConfigured?: undefined;
            clientSecretConfigured?: undefined;
            pixKeyConfigured?: undefined;
            certificateConfigured?: undefined;
            certificateFileName?: undefined;
            certificateHasPassphrase?: undefined;
            pixAutomaticEnabled?: undefined;
            receiverAccountConfigured?: undefined;
            skipMtlsChecking?: undefined;
        };
    }>;
    activateProvider(req: any, code: string, body: {
        paymentType?: string;
    }): Promise<{
        provider: {
            code: import("./payment-provider-config.service").PaymentProviderCode;
            name: any;
            description: any;
            active: boolean;
            activeFor: any;
            configured: boolean;
            configVersion: number;
            lastHealthCheckAt: any;
            lastHealthCheckOk: any;
            lastHealthCheckMessage: any;
            lastHealthCheckDetails: any;
            activatedAt: any;
            updatedAt: any;
            config: {
                environment: string;
                clientIdConfigured: boolean;
                clientSecretConfigured: boolean;
                pixKeyConfigured: boolean;
                certificateConfigured: boolean;
                certificateFileName: any;
                certificateHasPassphrase: boolean;
                pixAutomaticEnabled: boolean;
                receiverAccountConfigured: boolean;
                publicApiBaseUrl: any;
                skipMtlsChecking: boolean;
                capabilities: string[];
                accessTokenConfigured?: undefined;
                publicKeyConfigured?: undefined;
                webhookSecretConfigured?: undefined;
                marketplaceClientIdConfigured?: undefined;
                marketplaceClientId?: undefined;
                marketplaceClientSecretConfigured?: undefined;
                marketplaceRedirectUri?: undefined;
                checkoutApi?: undefined;
                recurringApi?: undefined;
                sdk?: undefined;
            } | {
                environment: string;
                accessTokenConfigured: boolean;
                publicKeyConfigured: boolean;
                webhookSecretConfigured: boolean;
                marketplaceClientIdConfigured: boolean;
                marketplaceClientId: any;
                marketplaceClientSecretConfigured: boolean;
                marketplaceRedirectUri: any;
                publicApiBaseUrl: any;
                capabilities: string[];
                checkoutApi: string;
                recurringApi: string;
                sdk: string;
                clientIdConfigured?: undefined;
                clientSecretConfigured?: undefined;
                pixKeyConfigured?: undefined;
                certificateConfigured?: undefined;
                certificateFileName?: undefined;
                certificateHasPassphrase?: undefined;
                pixAutomaticEnabled?: undefined;
                receiverAccountConfigured?: undefined;
                skipMtlsChecking?: undefined;
            };
        };
        routes: any;
    }>;
    deactivateProviderRoute(req: any, paymentType: string): Promise<any>;
    performance(): Promise<{
        products: any;
        highlights: {
            topSelling: any;
            topRevenue: any;
            topConversion: any;
        };
    }>;
    getProducts(): Promise<any>;
    updateProduct(code: string, body: Record<string, unknown>): Promise<any>;
    updateProductDuration(code: string, body: {
        durationDays?: number;
    }): Promise<any>;
    summary(): Promise<any>;
    searchUsers(query?: string, limit?: string): Promise<any>;
    getUserSupport(userId: string): Promise<{
        user: any;
        billing: any;
        credits: Record<string, number>;
        entitlements: any;
        subscriptions: any;
        payments: any;
        creditLedger: any;
    }>;
    setLifetime(req: any, userId: string, body: {
        enabled?: boolean;
        note?: string;
    }): Promise<any>;
    setCreditBalance(req: any, userId: string, rawFeature: string, body: {
        quantity?: number;
        note?: string;
    }): Promise<{
        feature: FeatureCredit;
        credits: number;
        previousCredits: number;
        delta: number;
    }>;
    grantEntitlement(req: any, userId: string, rawFeature: string, body: {
        durationDays?: number;
        note?: string;
    }): Promise<{
        feature: TimedFeature;
        durationDays: number;
        expiresAt: any;
    }>;
    revokeEntitlement(req: any, userId: string, rawFeature: string, body: {
        note?: string;
    }): Promise<any>;
    activateSubscription(req: any, userId: string, body: {
        productCode?: string;
        durationDays?: number;
        note?: string;
    }): Promise<any>;
    updateSubscriptionStatus(req: any, userId: string, subscriptionId: string, body: {
        status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
    }): Promise<any>;
    list(limit?: string): Promise<any>;
    confirm(req: any, id: string): Promise<any>;
    simulate(req: any, id: string): Promise<any>;
    grantCredit(userId: string, body: {
        feature?: FeatureCredit;
        quantity?: number;
    }): Promise<Record<string, number>>;
}
