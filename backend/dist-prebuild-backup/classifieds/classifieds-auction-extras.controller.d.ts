import { ClassifiedsAuctionEngagementService } from './classifieds-auction-engagement.service';
import { ClassifiedsAuctionPaymentPolicyService } from './classifieds-auction-payment-policy.service';
export declare class ClassifiedsAuctionExtrasController {
    private readonly engagement;
    private readonly paymentPolicy;
    constructor(engagement: ClassifiedsAuctionEngagementService, paymentPolicy: ClassifiedsAuctionPaymentPolicyService);
    paymentDefaults(req: any): Promise<{
        plan: "ELITE" | "PLUS" | "FREE";
        feeRule: {
            source: string;
            rateBps: number;
            percentage: number;
            minimumFeeCents: number;
            maximumFeeCents: number | null;
        } | null;
        auctionFeePayer: import("./classifieds-receipt-preferences.service").AuctionFeePayer;
        paymentMethods: string[];
        fulfillmentModes: string[];
        feeDisclosure: string;
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
    reminderStatus(req: any, auctionId: string): Promise<{
        enabled: boolean;
        lastPresenceAt: any;
    }>;
    reminder(req: any, auctionId: string, body: any): Promise<{
        enabled: boolean;
    }>;
    presence(req: any, auctionId: string): Promise<{
        recorded: boolean;
        at?: undefined;
    } | {
        recorded: boolean;
        at: string;
    }>;
    buyerSettlement(req: any, auctionId: string): Promise<{
        auctionId: string;
        listing: {
            id: any;
            title: any;
            slug: any;
            image: any;
        };
        seller: {
            companyId: any;
            name: any;
        };
        publicKey: string;
        amountCents: number;
        deliveryFeeCents: number;
        totalCents: number;
        fulfillmentModes: ("ARRANGE" | "PICKUP" | "DELIVERY")[];
        deliveryNote: any;
        buyer: {
            email: any;
            name: any;
            deliveryAddress: any;
        };
        terms: {
            version: string;
            accepted: boolean;
        };
        payment: {
            id: any;
            auctionId: any;
            totalCents: number;
            platformFeeCents: number;
            sellerNetCents: number;
            paymentMethod: any;
            paymentStatus: any;
            status: any;
            fulfillmentMode: any;
            fulfillmentData: any;
            providerStatusDetail: any;
            expiresAt: any;
            pix: {
                copyPaste: any;
                qrCodeBase64: any;
                ticketUrl: any;
            } | null;
        } | null;
    } | {
        publicKey: string;
        paymentMethods: string[];
        cardMaxInstallments: number;
        pickupAddress: any;
        auctionFeePayer: import("./classifieds-receipt-preferences.service").AuctionFeePayer;
        auctionFeeCents: number;
        buyerAuctionFeeCents: number;
        totalCents: number;
        feeDisclosure: string;
        auctionId: string;
        listing: {
            id: any;
            title: any;
            slug: any;
            image: any;
        };
        seller: {
            companyId: any;
            name: any;
        };
        amountCents: number;
        deliveryFeeCents: number;
        fulfillmentModes: ("ARRANGE" | "PICKUP" | "DELIVERY")[];
        deliveryNote: any;
        buyer: {
            email: any;
            name: any;
            deliveryAddress: any;
        };
        terms: {
            version: string;
            accepted: boolean;
        };
        payment: {
            id: any;
            auctionId: any;
            totalCents: number;
            platformFeeCents: number;
            sellerNetCents: number;
            paymentMethod: any;
            paymentStatus: any;
            status: any;
            fulfillmentMode: any;
            fulfillmentData: any;
            providerStatusDetail: any;
            expiresAt: any;
            pix: {
                copyPaste: any;
                qrCodeBase64: any;
                ticketUrl: any;
            } | null;
        } | null;
    }>;
    checkout(req: any, auctionId: string, body: Record<string, any>): Promise<{
        id: any;
        auctionId: any;
        totalCents: number;
        platformFeeCents: number;
        sellerNetCents: number;
        paymentMethod: any;
        paymentStatus: any;
        status: any;
        fulfillmentMode: any;
        fulfillmentData: any;
        providerStatusDetail: any;
        expiresAt: any;
        pix: {
            copyPaste: any;
            qrCodeBase64: any;
            ticketUrl: any;
        } | null;
    } | {
        processing: boolean;
        id: any;
        auctionId: any;
        totalCents: number;
        platformFeeCents: number;
        sellerNetCents: number;
        paymentMethod: any;
        paymentStatus: any;
        status: any;
        fulfillmentMode: any;
        fulfillmentData: any;
        providerStatusDetail: any;
        expiresAt: any;
        pix: {
            copyPaste: any;
            qrCodeBase64: any;
            ticketUrl: any;
        } | null;
    }>;
    sellerSettlement(req: any, auctionId: string): Promise<{
        auctionFeePayer: import("./classifieds-receipt-preferences.service").AuctionFeePayer;
        paymentMethods: string[];
        cardMaxInstallments: number;
        pickupAddress: any;
        feeSnapshot: {
            source: any;
            rateBps: number;
            percentage: number;
            minimumFeeCents: number;
            maximumFeeCents: number | null;
        } | null;
        auctionId: string;
        status: any;
        onlinePaymentEnabled: boolean;
        fulfillmentModes: ("ARRANGE" | "PICKUP" | "DELIVERY")[];
        deliveryFeeCents: number;
        deliveryNote: any;
        paymentConnected: boolean;
        sellerTermsAccepted: boolean;
        plan: "ELITE" | "PLUS" | "FREE";
        feeRule: {
            source: string;
            rateBps: number;
            percentage: number;
            minimumFeeCents: number;
            maximumFeeCents: number | null;
        } | null;
        finalAmount: number | null;
        winnerUserId: any;
        paymentStatus: any;
        orderId: any;
    }>;
    configureSeller(req: any, auctionId: string, body: Record<string, unknown>): Promise<{
        auctionFeePayer: import("./classifieds-receipt-preferences.service").AuctionFeePayer;
        paymentMethods: string[];
        cardMaxInstallments: number;
        pickupAddress: any;
        feeSnapshot: {
            source: any;
            rateBps: number;
            percentage: number;
            minimumFeeCents: number;
            maximumFeeCents: number | null;
        } | null;
        auctionId: string;
        status: any;
        onlinePaymentEnabled: boolean;
        fulfillmentModes: ("ARRANGE" | "PICKUP" | "DELIVERY")[];
        deliveryFeeCents: number;
        deliveryNote: any;
        paymentConnected: boolean;
        sellerTermsAccepted: boolean;
        plan: "ELITE" | "PLUS" | "FREE";
        feeRule: {
            source: string;
            rateBps: number;
            percentage: number;
            minimumFeeCents: number;
            maximumFeeCents: number | null;
        } | null;
        finalAmount: number | null;
        winnerUserId: any;
        paymentStatus: any;
        orderId: any;
    }>;
}
