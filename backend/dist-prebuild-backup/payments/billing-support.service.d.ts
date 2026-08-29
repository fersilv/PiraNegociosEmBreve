import { DataSource } from 'typeorm';
import { PaymentsService, type FeatureCredit } from './payments.service';
export type TimedFeature = 'JOB_MATCH_PREMIUM' | 'RESUME_BOOST' | 'EARLY_JOB_ALERTS';
export declare class BillingSupportService {
    private readonly dataSource;
    private readonly payments;
    constructor(dataSource: DataSource, payments: PaymentsService);
    private isTimedFeature;
    isLifetimeFree(userId: string): Promise<boolean>;
    getMyBillingStatus(userId: string): Promise<{
        lifetimeFree: boolean;
        isOpenToWork: boolean;
        resumeStatus: any;
        credits: Record<string, number>;
        entitlements: any;
        subscriptions: any;
    }>;
    searchUsers(query?: string, limit?: number): Promise<any>;
    getUserSupport(userId: string): Promise<{
        user: any;
        billing: any;
        credits: Record<string, number>;
        entitlements: any;
        subscriptions: any;
        payments: any;
        creditLedger: any;
    }>;
    setLifetimeFree(userId: string, enabled: boolean, adminUserId: string, note?: string): Promise<any>;
    setCreditBalance(userId: string, feature: FeatureCredit, quantity: number, adminUserId: string, note?: string): Promise<{
        feature: FeatureCredit;
        credits: number;
        previousCredits: number;
        delta: number;
    }>;
    grantTimedFeature(userId: string, feature: TimedFeature, durationDays: number, adminUserId: string, note?: string): Promise<{
        feature: TimedFeature;
        durationDays: number;
        expiresAt: any;
    }>;
    revokeTimedFeature(userId: string, feature: TimedFeature, adminUserId: string, note?: string): Promise<any>;
    private applyProductEntitlements;
    activateSubscription(userId: string, productCode: string, adminUserId: string, durationDays?: number, note?: string): Promise<any>;
    setSubscriptionStatus(userId: string, subscriptionId: string, status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED', adminUserId: string): Promise<any>;
    activateLifetimeProduct(userId: string, productCode: string): Promise<{
        lifetimeFree: boolean;
        product: any;
        activated: boolean;
    } | {
        lifetimeFree: boolean;
        product: any;
        activated: any[];
    } | null>;
}
