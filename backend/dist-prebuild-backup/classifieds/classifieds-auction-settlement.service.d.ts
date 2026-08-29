import { DataSource } from 'typeorm';
import { PaymentProviderConfigService } from '../payments/payment-provider-config.service';
import { ClassifiedsEntitlementsService } from './classifieds-entitlements.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsMarketplacePaymentsService } from './classifieds-marketplace-payments.service';
import { ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
export declare class ClassifiedsAuctionSettlementService {
    private readonly dataSource;
    private readonly identities;
    private readonly entitlements;
    private readonly marketplacePayments;
    private readonly providerConfig;
    private readonly terms;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService, entitlements: ClassifiedsEntitlementsService, marketplacePayments: ClassifiedsMarketplacePaymentsService, providerConfig: PaymentProviderConfigService, terms: ClassifiedsMarketplaceTermsService);
    sellerConfig(uid: string, auctionId: string): Promise<{
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
    configureSeller(uid: string, auctionId: string, body: Record<string, unknown>): Promise<{
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
    buyerConfig(uid: string, auctionId: string): Promise<{
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
    }>;
    createPayment(uid: string, auctionId: string, body: Record<string, any>): Promise<{
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
    resolveAuctionFeeRule(companyId: string, plan: 'FREE' | 'PLUS' | 'ELITE'): Promise<{
        source: string;
        rateBps: number;
        percentage: number;
        minimumFeeCents: number;
        maximumFeeCents: number | null;
    } | null>;
    private calculateFee;
    private assertSeller;
    private assertWinner;
    private auctionRows;
    private orderForAuction;
    private fulfillmentModes;
    private cleanModes;
    private fulfillmentMode;
    private fulfillmentData;
    private paymentMethod;
    private idempotencyKey;
    private cents;
    private moneyToCents;
    private paymentPayload;
    private applyPayment;
    private markProcessing;
    private mapStatus;
    private presentOrder;
}
