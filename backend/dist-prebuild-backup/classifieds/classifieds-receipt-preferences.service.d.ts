import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
export type AuctionFeePayer = 'SELLER' | 'BUYER';
export type ClassifiedPaymentMethod = 'PIX' | 'CARD';
export declare class ClassifiedsReceiptPreferencesService {
    private readonly dataSource;
    private readonly identities;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService);
    get(uid: string): Promise<{
        companyId: string;
        companyVerified: boolean;
        companyAddress: string;
        provider: any;
        pixEnabled: boolean;
        cardEnabled: boolean;
        cardMaxInstallments: number;
        auctionFeePayerDefault: AuctionFeePayer;
        pickupEnabled: boolean;
        deliveryEnabled: boolean;
        arrangeEnabled: boolean;
        onlineCheckoutDefault: boolean;
        paymentConnections: any;
        mercadoPagoConnected: any;
    }>;
    update(uid: string, body: Record<string, unknown>): Promise<{
        companyId: string;
        companyVerified: boolean;
        companyAddress: string;
        provider: any;
        pixEnabled: boolean;
        cardEnabled: boolean;
        cardMaxInstallments: number;
        auctionFeePayerDefault: AuctionFeePayer;
        pickupEnabled: boolean;
        deliveryEnabled: boolean;
        arrangeEnabled: boolean;
        onlineCheckoutDefault: boolean;
        paymentConnections: any;
        mercadoPagoConnected: any;
    }>;
    methodsFrom(body: Record<string, unknown>, fallback?: {
        pixEnabled?: boolean;
        cardEnabled?: boolean;
    }): string[];
    fulfillmentFrom(body: Record<string, unknown>, fallback?: {
        pickupEnabled?: boolean;
        deliveryEnabled?: boolean;
        arrangeEnabled?: boolean;
    }): string[];
    feePayer(value: unknown): AuctionFeePayer;
    installments(value: unknown): number;
    companyAddress(company: any): string;
    private assertCompany;
}
