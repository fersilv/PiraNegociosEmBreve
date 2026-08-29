import { DataSource } from 'typeorm';
export type PaymentProductCode = 'RESUME_REANALYSIS' | 'RESUME_AI_IMPROVEMENT' | 'RESUME_AI_IMPORT';
export type FeatureCredit = 'RESUME_REANALYSIS' | 'RESUME_AI_IMPROVEMENT' | 'RESUME_AI_IMPORT';
export declare class PaymentsService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    private currentPromoPrice;
    private presentProduct;
    listCatalog(includeDisabled?: boolean): Promise<any>;
    findProduct(code: string, includeDisabled?: boolean): Promise<any>;
    updateProduct(code: string, input: Record<string, unknown>): Promise<any>;
    getDevMode(): Promise<{
        enabled: boolean;
    }>;
    setDevMode(enabled: boolean): Promise<{
        enabled: boolean;
    }>;
    productPerformance(): Promise<{
        products: any;
        highlights: {
            topSelling: any;
            topRevenue: any;
            topConversion: any;
        };
    }>;
    createPixPayment(userId: string, productCode: string): Promise<any>;
    attachProviderCheckout(paymentId: string, checkout: {
        provider: string;
        providerPaymentId: string;
        pixCopyPaste?: string | null;
        qrCodeBase64?: string | null;
        expiresAt?: Date | string | null;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    cancelProviderCheckout(paymentId: string, error: unknown): Promise<any>;
    listUserPayments(userId: string): Promise<any>;
    listAllPayments(limit?: number): Promise<any>;
    paymentSummary(): Promise<any>;
    private featureForProduct;
    private settlePayment;
    activateCompanyPlanTrial(paymentId: string, input?: {
        provider?: string;
        providerSubscriptionId?: string | null;
    }): Promise<any>;
    confirmPayment(paymentId: string, metadata?: Record<string, unknown>): Promise<any>;
    confirmProviderPayment(paymentId: string, metadata?: Record<string, unknown>): Promise<any>;
    simulatePayment(paymentId: string, adminUserId: string): Promise<any>;
    getCredits(userId: string): Promise<Record<string, number>>;
    hasCredit(userId: string, feature: FeatureCredit): Promise<boolean>;
    consumeCredit(userId: string, feature: FeatureCredit): Promise<number>;
    grantCredit(userId: string, feature: FeatureCredit, quantity?: number): Promise<Record<string, number>>;
    private resumeSnapshot;
    recordAnalysis(userId: string, profile: any, analysis: Record<string, unknown>, source: 'FREE' | 'REANALYSIS' | 'IMPROVEMENT', paymentId?: string | null): Promise<any>;
    listAnalysisHistory(userId: string): Promise<any>;
    createImprovementProposal(userId: string, profile: any, proposal: Record<string, unknown>, paymentId?: string | null): Promise<any>;
    getImprovementProposal(userId: string, id: string): Promise<any>;
    completeImprovementProposal(userId: string, id: string, selectedChangeIds: string[], partial: boolean): Promise<any>;
    listImprovementHistory(userId: string): Promise<any>;
    listPublicationHistory(userId: string): Promise<any>;
}
