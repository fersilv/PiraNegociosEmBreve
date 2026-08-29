import { Repository } from 'typeorm';
import { ExternalApiClient } from './entities/external-api-client.entity';
export declare class JobsIntegrationsAdminController {
    private readonly clients;
    constructor(clients: Repository<ExternalApiClient>);
    capabilities(): {
        capabilities: import("./jobs-mcp.scopes").JobsCapability[];
        defaults: {
            v1: string[];
            v2: string[];
            mcp: string[];
        };
        policy: {
            mcpPermissionModel: string;
            legacyScopesAccepted: boolean;
            newKeysUseLegacyUmbrella: boolean;
        };
    };
    list(kindRaw?: string): Promise<{
        effectiveScopes: string[];
        usesLegacyScopes: boolean;
        id: string;
        name: string;
        sourceLabel: string;
        keyPrefix: string;
        scopes: string[];
        apiVersion: "v1" | "v2";
        audience: "api" | "mcp";
        active: boolean;
        createdById: string;
        lastUsedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(req: any, data: {
        kind?: string;
        name?: string;
        sourceLabel?: string;
        scopes?: string[];
    }): Promise<{
        client: {
            effectiveScopes: string[];
            usesLegacyScopes: boolean;
            id: string;
            name: string;
            sourceLabel: string;
            keyPrefix: string;
            scopes: string[];
            apiVersion: "v1" | "v2";
            audience: "api" | "mcp";
            active: boolean;
            createdById: string;
            lastUsedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        apiKey: string;
        warning: string;
    }>;
    update(id: string, data: {
        name?: string;
        sourceLabel?: string;
        active?: boolean;
        scopes?: string[];
    }): Promise<{
        effectiveScopes: string[];
        usesLegacyScopes: boolean;
        id: string;
        name: string;
        sourceLabel: string;
        keyPrefix: string;
        scopes: string[];
        apiVersion: "v1" | "v2";
        audience: "api" | "mcp";
        active: boolean;
        createdById: string;
        lastUsedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    rotate(id: string): Promise<{
        apiKey: string;
        warning: string;
    }>;
    private kind;
    private target;
    private scopesForKind;
    private newKey;
    private hash;
    private publicClient;
}
