import { DataSource } from 'typeorm';
import { PaymentsService } from '../payments/payments.service';
import { PaymentProviderManagerService, type PaymentCheckoutPayer } from '../payments/payment-provider-manager.service';
import { ResumeReviewService } from '../ai/resume-review.service';
import { ResumeImprovementService } from '../ai/resume-improvement.service';
export type PublicResumeProductCode = 'PUBLIC_RESUME_AI_REVIEW' | 'PUBLIC_RESUME_AI_IMPROVEMENT' | 'PUBLIC_RESUME_REMOVE_WATERMARK';
export declare class PublicResumeService {
    private readonly dataSource;
    private readonly payments;
    private readonly providers;
    private readonly resumeReview;
    private readonly resumeImprovement;
    constructor(dataSource: DataSource, payments: PaymentsService, providers: PaymentProviderManagerService, resumeReview: ResumeReviewService, resumeImprovement: ResumeImprovementService);
    private hash;
    private safeEqual;
    private cleanString;
    private cleanEventMetadata;
    private sessionForToken;
    private insertEvent;
    createSession(input: Record<string, unknown>, context: {
        userAgent?: string;
        referrer?: string;
    }): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        token: string;
        watermarkUnlocked: boolean;
        createdAt: string;
    }>;
    getSession(id: string, token: string): Promise<{
        id: any;
        status: any;
        watermarkUnlocked: boolean;
        converted: boolean;
        startedAt: any;
        lastSeenAt: any;
    }>;
    track(id: string, token: string, typeInput: unknown, metadataInput?: unknown): Promise<{
        ok: boolean;
    }>;
    catalog(): Promise<any>;
    private normalizeProductCode;
    private publicOrder;
    private recordPaidEventOnce;
    private syncOrderFromPayment;
    createCheckout(sessionId: string, token: string, input: {
        productCode?: unknown;
        payer?: PaymentCheckoutPayer;
    }): Promise<{
        product: any;
        checkoutReady: boolean;
        paymentRequired: boolean;
        devSimulation: boolean;
        id: any;
        productCode: any;
        status: any;
        amountCents: number;
        provider: any;
        pixCopyPaste: any;
        qrCodeBase64: any;
        expiresAt: any;
        paidAt: any;
        consumedAt: any;
        createdAt: any;
    } | {
        product: any;
        checkoutReady: boolean;
        paymentRequired: boolean;
        id: any;
        productCode: any;
        status: any;
        amountCents: number;
        provider: any;
        pixCopyPaste: any;
        qrCodeBase64: any;
        expiresAt: any;
        paidAt: any;
        consumedAt: any;
        createdAt: any;
    }>;
    getOrder(sessionId: string, token: string, orderId: string): Promise<{
        watermarkUnlocked: boolean;
        id: any;
        productCode: any;
        status: any;
        amountCents: number;
        provider: any;
        pixCopyPaste: any;
        qrCodeBase64: any;
        expiresAt: any;
        paidAt: any;
        consumedAt: any;
        createdAt: any;
    }>;
    private claimPaidOrder;
    private releaseClaim;
    reviewWithAi(sessionId: string, token: string, orderId: string, profile: unknown): Promise<import("../ai/resume-review.service").ResumeReviewResult>;
    improveWithAi(sessionId: string, token: string, orderId: string, profile: unknown): Promise<import("../ai/resume-improvement.service").ResumeImprovementProposal>;
    unlockWatermark(sessionId: string, token: string, orderId: string): Promise<{
        watermarkUnlocked: boolean;
    }>;
    linkAccount(sessionId: string, token: string, userId: string): Promise<{
        ok: boolean;
    }>;
    private syncAllOrders;
    adminSummary(daysInput: number): Promise<{
        periodDays: number;
        metrics: {
            sessions: number;
            resumesCreated: number;
            accountConversions: number;
            checkouts: number;
            sales: number;
            revenueCents: number;
            abandoned: number;
            sessionToResumePercent: number;
            checkoutConversionPercent: number;
            checkoutAbandonmentPercent: number;
        };
        funnel: {
            key: string;
            label: string;
            value: any;
        }[];
        products: any;
        sources: any;
        templates: any;
        recentOrders: any;
        recentEvents: any;
    }>;
}
