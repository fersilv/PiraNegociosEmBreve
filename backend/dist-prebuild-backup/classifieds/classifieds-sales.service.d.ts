import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import type { ClassifiedCommerceConfig } from './entities/classified-listing.entity';
export declare class ClassifiedsSalesService implements OnModuleInit, OnModuleDestroy {
    private readonly dataSource;
    private readonly identities;
    private readonly entitlements;
    private readonly notifications;
    private timer;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService, entitlements: ClassifiedsEntitlementsService, notifications: NotificationsService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    status(uid: string): Promise<{
        business: boolean;
        onlineSalesAvailable: boolean;
        plan: string;
        feeRule: null;
        paymentConnections: never[];
        companyId?: undefined;
        companyVerified?: undefined;
    } | {
        business: boolean;
        companyId: string;
        companyVerified: boolean;
        onlineSalesAvailable: any;
        plan: "ELITE" | "PLUS" | "FREE";
        feeRule: {
            source: string;
            rateBps: number;
            percentage: number;
            minimumFeeCents: number;
            maximumFeeCents: number | null;
        } | null;
        paymentConnections: any;
    }>;
    getListingCommerce(uid: string, listingId: string): Promise<{
        listingId: any;
        listingType: any;
        basePrice: any;
        commerceConfig: any;
        pricing: {
            basePrice: number | null;
            currentPrice: number | null;
            promotionActive: boolean;
            promotionEndsAt: string | null;
            pixPrice: number | null;
            cardPrice: number | null;
            maxInstallments: number;
            interestFreeInstallments: number;
        };
    }>;
    configureListing(uid: string, listingId: string, raw: Record<string, unknown>): Promise<{
        listingId: any;
        listingType: any;
        basePrice: any;
        commerceConfig: any;
        pricing: {
            basePrice: number | null;
            currentPrice: number | null;
            promotionActive: boolean;
            promotionEndsAt: string | null;
            pixPrice: number | null;
            cardPrice: number | null;
            maxInstallments: number;
            interestFreeInstallments: number;
        };
    }>;
    inventory(uid: string): Promise<any>;
    updateInventory(uid: string, listingId: string, raw: Record<string, unknown>): Promise<{
        id: any;
        title: any;
        status: any;
        updatedAt: any;
        stockQuantity: number | null;
        lowStockThreshold: number | null;
        onlineCheckoutEnabled: boolean;
    }>;
    dashboard(uid: string): Promise<{
        totals: any;
        recentOrders: any;
        products: any;
        calendar: any;
    }>;
    orders(uid: string): Promise<any>;
    updateOrderStatus(uid: string, orderId: string, rawStatus: unknown): Promise<any>;
    appointments(uid: string): Promise<any>;
    expirePromotions(): Promise<{
        paused: any;
    }>;
    resolveFeeRule(companyId: string, plan: 'FREE' | 'PLUS' | 'ELITE'): Promise<{
        source: string;
        rateBps: number;
        percentage: number;
        minimumFeeCents: number;
        maximumFeeCents: number | null;
    } | null>;
    calculatePlatformFee(totalCents: number, rule: {
        rateBps: number;
        minimumFeeCents: number;
        maximumFeeCents: number | null;
    }): number;
    effectivePricing(basePrice: unknown, config: ClassifiedCommerceConfig | null | undefined): {
        basePrice: number | null;
        currentPrice: number | null;
        promotionActive: boolean;
        promotionEndsAt: string | null;
        pixPrice: number | null;
        cardPrice: number | null;
        maxInstallments: number;
        interestFreeInstallments: number;
    };
    private cleanCommerceConfig;
    private assertOwner;
    private inventoryItem;
    private moneyNumber;
    private nonNegativeNumber;
    private optionalDate;
    private int;
    private phone;
    private statusLabel;
}
