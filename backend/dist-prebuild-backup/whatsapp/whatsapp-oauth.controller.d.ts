import type { Response } from 'express';
import { OAuthBrokerService } from './oauth-broker.service';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';
export declare class WhatsAppOAuthController {
    private readonly oauth;
    private readonly broker;
    constructor(oauth: WhatsAppOAuthService, broker: OAuthBrokerService);
    standardResourceMetadata(instanceId: string): Promise<{
        resource: string;
        authorization_servers: string[];
        scopes_supported: string[];
        bearer_methods_supported: string[];
        resource_name: string;
    }>;
    resourceMetadata(instanceId: string): Promise<{
        resource: string;
        authorization_servers: string[];
        scopes_supported: string[];
        bearer_methods_supported: string[];
        resource_name: string;
    }>;
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
