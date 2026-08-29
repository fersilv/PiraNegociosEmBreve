export declare class PaymentProviderVaultService {
    private readonly keyPath;
    private masterKey;
    private getKey;
    encrypt(value: Record<string, unknown>): string;
    decrypt<T extends Record<string, unknown>>(payload?: string | null): T;
    status(): {
        encryptedAtRest: boolean;
        algorithm: string;
        keyStorage: string;
        keyPathHint: string;
    };
}
