import { PublicResumeService } from './public-resume.service';
export declare class PublicResumeController {
    private readonly publicResume;
    constructor(publicResume: PublicResumeService);
    createSession(req: any, body: Record<string, unknown>): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        token: string;
        watermarkUnlocked: boolean;
        createdAt: string;
    }>;
    catalog(): Promise<any>;
    getSession(sessionId: string, token: string): Promise<{
        id: any;
        status: any;
        watermarkUnlocked: boolean;
        converted: boolean;
        startedAt: any;
        lastSeenAt: any;
    }>;
    event(sessionId: string, token: string, body: {
        type?: unknown;
        metadata?: unknown;
    }): Promise<{
        ok: boolean;
    }>;
    checkout(sessionId: string, token: string, body: {
        productCode?: unknown;
        payer?: Record<string, string>;
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
    order(sessionId: string, orderId: string, token: string): Promise<{
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
    unlockWatermark(sessionId: string, orderId: string, token: string): Promise<{
        watermarkUnlocked: boolean;
    }>;
    review(sessionId: string, token: string, body: {
        orderId?: string;
        profile?: unknown;
    }): Promise<import("../ai/resume-review.service").ResumeReviewResult>;
    improve(sessionId: string, token: string, body: {
        orderId?: string;
        profile?: unknown;
    }): Promise<import("../ai/resume-improvement.service").ResumeImprovementProposal>;
}
export declare class PublicResumeAccountController {
    private readonly publicResume;
    constructor(publicResume: PublicResumeService);
    link(req: any, body: {
        sessionId?: string;
        token?: string;
    }): Promise<{
        ok: boolean;
    }>;
}
export declare class AdminPublicResumeController {
    private readonly publicResume;
    constructor(publicResume: PublicResumeService);
    summary(days?: string): Promise<{
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
