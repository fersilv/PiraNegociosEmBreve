import { DataSource } from 'typeorm';
import { PaymentProviderVaultService } from './payment-provider-vault.service';
type TestProfileCode = 'ORDERS' | 'SUBSCRIPTIONS' | 'MARKETPLACE';
export declare class MercadoPagoTestLabService {
    private readonly dataSource;
    private readonly vault;
    constructor(dataSource: DataSource, vault: PaymentProviderVaultService);
    overview(): Promise<{
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
    saveProfile(profileInput: string, input: Record<string, unknown>, adminUserId: string): Promise<{
        profile: TestProfileCode;
        applicationId: string | null;
        publicKeyConfigured: boolean;
        accessTokenConfigured: boolean;
        sellerAccessTokenConfigured: boolean;
        payerEmail: string;
        updatedAt: string | null;
    }>;
    testCredentials(profileInput: string, adminUserId: string): Promise<{
        ok: boolean;
        profile: TestProfileCode;
        userId: any;
        nickname: any;
        applicationId: string | null;
    }>;
    createOrder(adminUserId: string): Promise<{
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
    getOrder(orderIdInput: string, adminUserId: string): Promise<{
        orderId: string;
        status: any;
        totalAmount: any;
        externalReference: any;
        transactionId: any;
        transactionStatus: any;
        transactionStatusDetail: any;
    }>;
    createSubscription(adminUserId: string): Promise<{
        ok: boolean;
        profile: "SUBSCRIPTIONS";
        preapprovalId: string;
        status: any;
        initPoint: any;
        externalReference: string;
        payerEmail: string;
    }>;
    getSubscription(preapprovalIdInput: string, adminUserId: string): Promise<{
        preapprovalId: string;
        status: any;
        payerEmail: any;
        nextPaymentDate: any;
        externalReference: any;
        initPoint: any;
    }>;
    createMarketplaceSplit(adminUserId: string): Promise<{
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
    getMarketplacePayment(paymentIdInput: string, adminUserId: string): Promise<{
        paymentId: string;
        status: any;
        statusDetail: any;
        transactionAmount: any;
        applicationFee: any;
        externalReference: any;
    }>;
    history(): Promise<any>;
    private secretProfile;
    private safeProfile;
    private profile;
    private tokenForProfile;
    private text;
    private email;
    private required;
    private request;
    private record;
    private errorMessage;
}
export {};
