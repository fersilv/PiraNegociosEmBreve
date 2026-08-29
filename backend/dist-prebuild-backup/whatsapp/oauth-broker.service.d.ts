import { Repository } from 'typeorm';
import { JobsOAuthClient } from '../external-api/entities/jobs-oauth.entity';
import { JobsOAuthService } from '../external-api/jobs-oauth.service';
import { WhatsAppOAuthClient } from './entities/whatsapp-oauth.entity';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';
export declare class OAuthBrokerService {
    private readonly whatsappOAuth;
    private readonly jobsOAuth;
    private readonly whatsappClients;
    private readonly jobsClients;
    constructor(whatsappOAuth: WhatsAppOAuthService, jobsOAuth: JobsOAuthService, whatsappClients: Repository<WhatsAppOAuthClient>, jobsClients: Repository<JobsOAuthClient>);
    publicBaseUrl(): string;
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
    registerClient(body: Record<string, unknown>): Promise<{
        client_id: string;
        client_name: string | null;
        redirect_uris: string[];
        grant_types: string[];
        response_types: string[];
        token_endpoint_auth_method: string;
    }>;
    buildAuthorizationPage(input: Record<string, unknown>): Promise<string>;
    approveAuthorization(input: Record<string, unknown>): Promise<string>;
    exchangeToken(input: Record<string, unknown>): Promise<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        scope: string;
    }>;
    isJobsResource(resource: string): boolean;
    isWhatsAppResource(resource: string): boolean;
    private normalizeIssuer;
    private ensureSharedClient;
}
