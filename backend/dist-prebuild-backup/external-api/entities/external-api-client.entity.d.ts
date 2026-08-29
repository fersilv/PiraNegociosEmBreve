export declare class ExternalApiClient {
    id: string;
    name: string;
    sourceLabel: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    apiVersion: 'v1' | 'v2';
    audience: 'api' | 'mcp';
    active: boolean;
    createdById: string;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
