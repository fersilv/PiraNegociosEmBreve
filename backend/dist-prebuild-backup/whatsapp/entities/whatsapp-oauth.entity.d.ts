export declare class WhatsAppOAuthClient {
    id: string;
    clientId: string;
    clientName: string | null;
    redirectUris: string[];
    tokenEndpointAuthMethod: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class WhatsAppOAuthCode {
    id: string;
    codeHash: string;
    clientId: string;
    instanceId: string;
    redirectUri: string;
    resource: string;
    scopes: string[];
    codeChallenge: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
}
export declare class WhatsAppOAuthToken {
    id: string;
    instanceId: string;
    clientId: string;
    accessTokenHash: string;
    refreshTokenHash: string;
    resource: string;
    scopes: string[];
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
