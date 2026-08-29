import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { ClassifiedsReceiptPreferencesService } from './classifieds-receipt-preferences.service';
import { ClassifiedsSalesService } from './classifieds-sales.service';
export declare class ClassifiedsSalesController {
    private readonly sales;
    private readonly marketplacePayments;
    private readonly receiptPreferences;
    constructor(sales: ClassifiedsSalesService, marketplacePayments: ClassifiedsMarketplacePaymentsService, receiptPreferences: ClassifiedsReceiptPreferencesService);
    commerceStatus(req: any): Promise<{
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
    listingCommerce(req: any, listingId: string): Promise<{
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
    configureListing(req: any, listingId: string, body: Record<string, unknown>): Promise<{
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
    inventory(req: any): Promise<any>;
    updateInventory(req: any, listingId: string, body: Record<string, unknown>): Promise<{
        id: any;
        title: any;
        status: any;
        updatedAt: any;
        stockQuantity: number | null;
        lowStockThreshold: number | null;
        onlineCheckoutEnabled: boolean;
    }>;
    dashboard(req: any): Promise<{
        totals: any;
        recentOrders: any;
        products: any;
        calendar: any;
    }>;
    orders(req: any): Promise<any>;
    updateOrderStatus(req: any, orderId: string, body: any): Promise<any>;
    appointments(req: any): Promise<any>;
    paymentConnections(req: any): Promise<any>;
    receiptSettings(req: any): Promise<{
        companyId: string;
        companyVerified: boolean;
        companyAddress: string;
        provider: any;
        pixEnabled: boolean;
        cardEnabled: boolean;
        cardMaxInstallments: number;
        auctionFeePayerDefault: import("./classifieds-receipt-preferences.service").AuctionFeePayer;
        pickupEnabled: boolean;
        deliveryEnabled: boolean;
        arrangeEnabled: boolean;
        onlineCheckoutDefault: boolean;
        paymentConnections: any;
        mercadoPagoConnected: any;
    }>;
    updateReceiptSettings(req: any, body: Record<string, unknown>): Promise<{
        companyId: string;
        companyVerified: boolean;
        companyAddress: string;
        provider: any;
        pixEnabled: boolean;
        cardEnabled: boolean;
        cardMaxInstallments: number;
        auctionFeePayerDefault: import("./classifieds-receipt-preferences.service").AuctionFeePayer;
        pickupEnabled: boolean;
        deliveryEnabled: boolean;
        arrangeEnabled: boolean;
        onlineCheckoutDefault: boolean;
        paymentConnections: any;
        mercadoPagoConnected: any;
    }>;
    startMercadoPago(req: any): Promise<{
        provider: string;
        authorizationUrl: string;
        pkce: boolean;
    }>;
    completeMercadoPago(req: any, body: any): Promise<{
        connected: boolean;
        provider: string;
        externalUserId: string | null | undefined;
        tokenExpiresAt: Date | null;
        pkce: boolean;
    }>;
    disconnectMercadoPago(req: any): Promise<{
        disconnected: boolean;
    }>;
}
