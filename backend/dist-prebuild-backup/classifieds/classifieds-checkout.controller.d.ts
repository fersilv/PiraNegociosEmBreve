import { ClassifiedsCheckoutService } from './classifieds-checkout.service';
import { ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
export declare class ClassifiedsCheckoutController {
    private readonly checkout;
    private readonly terms;
    constructor(checkout: ClassifiedsCheckoutService, terms: ClassifiedsMarketplaceTermsService);
    config(req: any, listingId: string): Promise<{
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
        paymentMethods: ("PIX" | "CARD")[];
        fulfillmentModes: ("ARRANGE" | "PICKUP" | "DELIVERY")[];
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
    createPayment(req: any, listingId: string, body: Record<string, any>): Promise<{
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
    purchases(req: any): Promise<any>;
    termsStatus(req: any): Promise<{
        version: string;
        termsUrl: string;
        buyerAccepted: boolean;
        sellerAccepted: boolean;
        sellerAvailable: boolean;
        schemaReady: boolean;
        message: string;
    } | {
        version: string;
        termsUrl: string;
        buyerAccepted: boolean;
        sellerAccepted: boolean;
        sellerAvailable: boolean;
        schemaReady: boolean;
        message?: undefined;
    }>;
    acceptTerms(req: any, userAgent: string | undefined, body: any): Promise<{
        accepted: boolean;
        scope: import("./classifieds-marketplace-terms.service").ClassifiedPaymentTermsScope;
        version: string;
        acceptedAt: string;
    }>;
}
