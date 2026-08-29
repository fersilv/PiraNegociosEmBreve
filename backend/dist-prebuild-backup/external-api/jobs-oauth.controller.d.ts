import type { Response } from 'express';
import { JobsOAuthService } from './jobs-oauth.service';
export declare class JobsOAuthController {
    private readonly oauth;
    constructor(oauth: JobsOAuthService);
    private sharedAuthorizationServerMetadata;
    private sharedResourceMetadata;
    authorizationServerMetadata(): {
        issuer: string;
        authorization_endpoint: string;
        token_endpoint: string;
        registration_endpoint: string;
        service_documentation: string;
        response_types_supported: string[];
        grant_types_supported: string[];
        code_challenge_methods_supported: string[];
        token_endpoint_auth_methods_supported: string[];
        scopes_supported: string[];
    };
    openIdConfiguration(): {
        issuer: string;
        authorization_endpoint: string;
        token_endpoint: string;
        registration_endpoint: string;
        service_documentation: string;
        response_types_supported: string[];
        grant_types_supported: string[];
        code_challenge_methods_supported: string[];
        token_endpoint_auth_methods_supported: string[];
        scopes_supported: string[];
    };
    standardResourceMetadata(): {
        authorization_servers: string[];
        resource: string;
        scopes_supported: string[];
        bearer_methods_supported: string[];
        resource_name: string;
    };
    resourceMetadata(): {
        authorization_servers: string[];
        resource: string;
        scopes_supported: string[];
        bearer_methods_supported: string[];
        resource_name: string;
    };
    register(body: Record<string, unknown>): Promise<{
        client_id: string;
        client_name: string | null;
        redirect_uris: string[];
        grant_types: string[];
        response_types: string[];
        token_endpoint_auth_method: string;
    }>;
    authorizePage(query: Record<string, unknown>, res: Response): Promise<void>;
    approve(body: Record<string, unknown>, res: Response): Promise<void>;
    token(body: Record<string, unknown>): Promise<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        scope: string;
    }>;
}
