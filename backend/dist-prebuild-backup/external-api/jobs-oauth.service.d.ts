import { Repository } from 'typeorm';
import { ExternalApiClient } from './entities/external-api-client.entity';
import { JobsOAuthClient, JobsOAuthCode, JobsOAuthToken } from './entities/jobs-oauth.entity';
export declare class JobsOAuthService {
    private readonly apiClients;
    private readonly clients;
    private readonly codes;
    private readonly tokens;
    constructor(apiClients: Repository<ExternalApiClient>, clients: Repository<JobsOAuthClient>, codes: Repository<JobsOAuthCode>, tokens: Repository<JobsOAuthToken>);
    publicBaseUrl(): string;
    issuer(): string;
    mcpResource(): string;
    resourceMetadataUrl(): string;
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
    resourceMetadata(): {
        resource: string;
        authorization_servers: string[];
        scopes_supported: string[];
        bearer_methods_supported: string[];
        resource_name: string;
    };
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
    verifyAccessToken(rawToken: string): Promise<{
        token: JobsOAuthToken;
        apiClient: ExternalApiClient;
        scopes: string[];
    }>;
    private exchangeAuthorizationCode;
    private exchangeRefreshToken;
    private issueTokens;
    private validateAuthorizationRequest;
    private requestedScopes;
    private validateApiKey;
    private effectiveClientScopes;
    private requireClient;
    private isAllowedRedirectUri;
    private hash;
    private pkceChallenge;
    private escapeHtml;
}
