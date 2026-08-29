import { DataSource } from 'typeorm';
import { PaymentProviderConfigService } from '../payments/payment-provider-config.service';
import { PaymentProviderVaultService } from '../payments/payment-provider-vault.service';
import { ClassifiedsIdentityService } from './classifieds-identity.service';
import { ClassifiedsMarketplaceTermsService } from './classifieds-marketplace-terms.service';
type MercadoPagoSellerCredentials = {
    accessToken: string;
    refreshToken?: string | null;
    publicKey?: string | null;
    tokenType?: string | null;
    userId?: string | null;
    scope?: string | null;
    obtainedAt: string;
};
export declare class ClassifiedsMarketplacePaymentsService {
    private readonly dataSource;
    private readonly identities;
    private readonly providerConfig;
    private readonly vault;
    private readonly terms;
    constructor(dataSource: DataSource, identities: ClassifiedsIdentityService, providerConfig: PaymentProviderConfigService, vault: PaymentProviderVaultService, terms: ClassifiedsMarketplaceTermsService);
    connections(uid: string): Promise<any>;
    startMercadoPago(uid: string): Promise<{
        provider: string;
        authorizationUrl: string;
        pkce: boolean;
    }>;
    completeMercadoPago(uid: string, stateRaw: unknown, codeRaw: unknown): Promise<{
        connected: boolean;
        provider: string;
        externalUserId: string | null | undefined;
        tokenExpiresAt: Date | null;
        pkce: boolean;
    }>;
    disconnectMercadoPago(uid: string): Promise<{
        disconnected: boolean;
    }>;
    sellerMercadoPagoCredentials(companyId: string): Promise<MercadoPagoSellerCredentials>;
    private refreshMercadoPago;
    private exchangeMercadoPagoCode;
    private marketplaceConfig;
    private markConnectionError;
    private assertVerifiedCompany;
    private hash;
}
export {};
