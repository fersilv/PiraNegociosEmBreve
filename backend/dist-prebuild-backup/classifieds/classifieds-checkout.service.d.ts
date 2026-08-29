import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentProviderConfigService } from '../payments/payment-provider-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
import { ClassifiedsSalesService } from './classifieds-sales.service';
type CheckoutMethod = 'PIX' | 'CARD';
type FulfillmentMode = 'ARRANGE' | 'PICKUP' | 'DELIVERY';
export declare class ClassifiedsCheckoutService implements OnModuleInit, OnModuleDestroy {
    private readonly dataSource;
    private readonly marketplacePayments;
    private readonly providerConfig;
    private readonly sales;
    private readonly entitlements;
    private readonly terms;
    private readonly notifications;
    private expirationTimer;
    constructor(dataSource: DataSource, marketplacePayments: ClassifiedsMarketplacePaymentsService, providerConfig: PaymentProviderConfigService, sales: ClassifiedsSalesService, entitlements: ClassifiedsEntitlementsService, terms: ClassifiedsMarketplaceTermsService, notifications: NotificationsService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    config(uid: string, listingId: string): Promise<{
        listing: {
            id: any;
            slug: any;
            title: any;
            image: any;
            companyName: any;
        };
        provider: string;
        publicKey: string;
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
        paymentMethods: CheckoutMethod[];
        fulfillmentModes: FulfillmentMode[];
        stockQuantity: number | null;
        available: boolean;
        buyer: {
            email: any;
            name: any;
            deliveryAddress: any;
            city: any;
            state: any;
        };
        terms: {
            version: string;
            accepted: boolean;
            url: string;
        };
    }>;
    acceptBuyerTerms(uid: string, metadata?: Record<string, unknown>): Promise<{
        accepted: boolean;
        scope: import("./classifieds-marketplace-terms.service").ClassifiedPaymentTermsScope;
        version: string;
        acceptedAt: string;
    }>;
    purchases(uid: string): Promise<any>;
    createPayment(uid: string, listingId: string, body: Record<string, any>): Promise<{
        id: any;
        listingId: any;
        title: any;
        slug: any;
        image: any;
        companyName: any;
        quantity: number;
        unitPriceCents: number;
        discountCents: number;
        totalCents: number;
        paymentProvider: any;
        paymentMethod: any;
        paymentStatus: any;
        providerStatusDetail: any;
        status: any;
        fulfillmentMode: any;
        fulfillmentData: any;
        createdAt: any;
        updatedAt: any;
        expiresAt: any;
        pix: {
            copyPaste: any;
            qrCodeBase64: any;
            ticketUrl: any;
        } | null;
    }>;
    mercadoPagoWebhook(headers: Record<string, unknown>, query: Record<string, any>, body: Record<string, any>): Promise<{
        received: boolean;
        ignored: string;
    } | {
        received: boolean;
        ignored?: undefined;
    }>;
    expirePendingOrders(): Promise<{
        expired: any;
    }>;
    private checkoutListing;
    private assertCheckoutListing;
    private assertNotSeller;
    private paymentMethod;
    private quantity;
    private idempotencyKey;
    private fulfillmentModes;
    private fulfillmentMode;
    private fulfillmentData;
    private stockQuantity;
    private withStock;
    private toCents;
    private paymentPayload;
    private callMercadoPagoPayment;
    private fetchMercadoPagoPayment;
    private applyProviderPayment;
    private mapPaymentStatus;
    private notifyPaymentChange;
    private releaseReservedStock;
    private commitReservedStock;
    private orderById;
    private presentOrder;
    private platformMercadoPagoConfig;
    private verifyWebhook;
    private providerError;
    private currencyCents;
}
export {};
