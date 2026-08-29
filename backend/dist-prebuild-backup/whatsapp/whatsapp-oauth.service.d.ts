import { Repository } from 'typeorm';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';
import { WhatsAppOAuthClient, WhatsAppOAuthCode, WhatsAppOAuthToken } from './entities/whatsapp-oauth.entity';
export declare class WhatsAppOAuthService {
    private readonly instances;
    private readonly apiKeys;
    private readonly clients;
    private readonly codes;
    private readonly tokens;
    constructor(instances: Repository<WhatsAppInstance>, apiKeys: Repository<WhatsAppApiKey>, clients: Repository<WhatsAppOAuthClient>, codes: Repository<WhatsAppOAuthCode>, tokens: Repository<WhatsAppOAuthToken>);
    publicBaseUrl(): string;
    mcpResource(instanceId: string): string;
    resourceMetadataUrl(instanceId: string): string;
    authorizationServerMetadata(): {
        issuer: string;
        authorization_endpoint: string;
        token_endpoint: string;
        registration_endpoint: string;
        response_types_supported: string[];
        grant_types_supported: string[];
        code_challenge_methods_supported: string[];
        token_endpoint_auth_methods_supported: string[];
        scopes_supported: string[];
        service_documentation: string;
    };
    resourceMetadata(instanceId: string): Promise<{
        resource: string;
        authorization_servers: string[];
        scopes_supported: string[];
        bearer_methods_supported: string[];
        resource_name: string;
    }>;
    registerClient(body: Record<string, unknown>): Promise<{
        client_id: string;
        client_name: string | null;
        redirect_uris: string[];
        grant_types: string[];
        response_types: string[];
        token_endpoint_auth_method: string;
    }>;
    buildAuthorizationPage(query: Record<string, unknown>): Promise<string>;
    approveAuthorization(body: Record<string, unknown>): Promise<string>;
    exchangeToken(body: Record<string, unknown>): Promise<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        scope: string;
    }>;
    verifyAccessToken(instanceId: string, rawToken: string): Promise<{
        token: WhatsAppOAuthToken;
        instance: WhatsAppInstance;
        scopes: string[];
    }>;
    private exchangeAuthorizationCode;
    private exchangeRefreshToken;
    private issueTokens;
    private validateAuthorizationRequest;
    private requireClient;
    private requireInstanceFromResource;
    private requestedScopes;
    private validateApiKey;
    private isAllowedRedirectUri;
    private hash;
    private pkceChallenge;
    private escapeHtml;
}
