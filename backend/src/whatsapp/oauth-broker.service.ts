import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobsOAuthClient } from '../external-api/entities/jobs-oauth.entity';
import { JOBS_MCP_SCOPES } from '../external-api/jobs-mcp.scopes';
import { JobsOAuthService } from '../external-api/jobs-oauth.service';
import { WhatsAppOAuthClient } from './entities/whatsapp-oauth.entity';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';
import { WHATSAPP_SCOPES } from './whatsapp.scopes';

@Injectable()
export class OAuthBrokerService {
  constructor(
    private readonly whatsappOAuth: WhatsAppOAuthService,
    private readonly jobsOAuth: JobsOAuthService,
    @InjectRepository(WhatsAppOAuthClient)
    private readonly whatsappClients: Repository<WhatsAppOAuthClient>,
    @InjectRepository(JobsOAuthClient)
    private readonly jobsClients: Repository<JobsOAuthClient>,
  ) {}

  publicBaseUrl() {
    return this.whatsappOAuth.publicBaseUrl();
  }

  authorizationServerMetadata() {
    const base = this.publicBaseUrl();
    return {
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: Array.from(
        new Set([...WHATSAPP_SCOPES, ...JOBS_MCP_SCOPES, 'offline_access']),
      ),
      service_documentation: `${base}/admin/api`,
    };
  }

  async registerClient(body: Record<string, unknown>) {
    const registration = await this.whatsappOAuth.registerClient(body);
    await this.ensureSharedClient(String(registration.client_id || ''));
    return registration;
  }

  async buildAuthorizationPage(input: Record<string, unknown>) {
    await this.ensureSharedClient(String(input.client_id || ''));
    const resource = String(input.resource || '').trim();
    if (this.isJobsResource(resource)) {
      return this.jobsOAuth.buildAuthorizationPage(input);
    }
    if (this.isWhatsAppResource(resource)) {
      return this.whatsappOAuth.buildAuthorizationPage(input);
    }
    throw new BadRequestException('resource não pertence a um MCP conhecido do PiraNegócios.');
  }

  async approveAuthorization(input: Record<string, unknown>) {
    await this.ensureSharedClient(String(input.client_id || ''));
    const resource = String(input.resource || '').trim();
    const redirect = this.isJobsResource(resource)
      ? await this.jobsOAuth.approveAuthorization(input)
      : this.isWhatsAppResource(resource)
        ? await this.whatsappOAuth.approveAuthorization(input)
        : null;
    if (!redirect) {
      throw new BadRequestException('resource não pertence a um MCP conhecido do PiraNegócios.');
    }
    return this.normalizeIssuer(redirect);
  }

  async exchangeToken(input: Record<string, unknown>) {
    await this.ensureSharedClient(String(input.client_id || ''));
    const code = String(input.code || '').trim();
    const refresh = String(input.refresh_token || '').trim();
    const resource = String(input.resource || '').trim();

    if (
      code.startsWith('pn_jobs_oauth_code_') ||
      refresh.startsWith('pn_jobs_oauth_rt_') ||
      this.isJobsResource(resource)
    ) {
      return this.jobsOAuth.exchangeToken(input);
    }
    if (
      code.startsWith('pn_oauth_code_') ||
      refresh.startsWith('pn_oauth_rt_') ||
      this.isWhatsAppResource(resource)
    ) {
      return this.whatsappOAuth.exchangeToken(input);
    }
    throw new BadRequestException('Não foi possível identificar o recurso MCP deste token OAuth.');
  }

  isJobsResource(resource: string) {
    return String(resource || '') === this.jobsOAuth.mcpResource();
  }

  isWhatsAppResource(resource: string) {
    try {
      const value = new URL(String(resource || ''));
      const base = new URL(this.publicBaseUrl());
      return (
        value.origin === base.origin &&
        /^\/api\/whatsapp\/mcp\/[^/]+\/?$/.test(value.pathname)
      );
    } catch {
      return false;
    }
  }

  private normalizeIssuer(redirect: string) {
    const url = new URL(redirect);
    url.searchParams.set('iss', this.publicBaseUrl());
    return url.toString();
  }

  private async ensureSharedClient(clientId: string) {
    if (!clientId) return;
    const [whatsapp, jobs] = await Promise.all([
      this.whatsappClients.findOne({ where: { clientId, active: true } }),
      this.jobsClients.findOne({ where: { clientId, active: true } }),
    ]);

    if (whatsapp && !jobs) {
      await this.jobsClients
        .save(
          this.jobsClients.create({
            clientId: whatsapp.clientId,
            clientName: whatsapp.clientName,
            redirectUris: whatsapp.redirectUris,
            tokenEndpointAuthMethod: whatsapp.tokenEndpointAuthMethod,
            active: whatsapp.active,
          }),
        )
        .catch(async () => {
          const existing = await this.jobsClients.findOne({ where: { clientId } });
          if (!existing) throw new BadRequestException('Não foi possível sincronizar o cliente OAuth de vagas.');
        });
    }

    if (jobs && !whatsapp) {
      await this.whatsappClients
        .save(
          this.whatsappClients.create({
            clientId: jobs.clientId,
            clientName: jobs.clientName,
            redirectUris: jobs.redirectUris,
            tokenEndpointAuthMethod: jobs.tokenEndpointAuthMethod,
            active: jobs.active,
          }),
        )
        .catch(async () => {
          const existing = await this.whatsappClients.findOne({ where: { clientId } });
          if (!existing) throw new BadRequestException('Não foi possível sincronizar o cliente OAuth compartilhado.');
        });
    }
  }
}
