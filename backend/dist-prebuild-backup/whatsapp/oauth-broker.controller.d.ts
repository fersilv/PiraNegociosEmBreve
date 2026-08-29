import type { Response } from 'express';
import { OAuthBrokerService } from './oauth-broker.service';
export declare class OAuthBrokerController {
    private readonly broker;
    constructor(broker: OAuthBrokerService);
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
    openIdConfiguration(): {
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
