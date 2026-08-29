"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthBrokerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jobs_oauth_entity_1 = require("../external-api/entities/jobs-oauth.entity");
const jobs_mcp_scopes_1 = require("../external-api/jobs-mcp.scopes");
const jobs_oauth_service_1 = require("../external-api/jobs-oauth.service");
const whatsapp_oauth_entity_1 = require("./entities/whatsapp-oauth.entity");
const whatsapp_oauth_service_1 = require("./whatsapp-oauth.service");
const whatsapp_scopes_1 = require("./whatsapp.scopes");
let OAuthBrokerService = class OAuthBrokerService {
    whatsappOAuth;
    jobsOAuth;
    whatsappClients;
    jobsClients;
    constructor(whatsappOAuth, jobsOAuth, whatsappClients, jobsClients) {
        this.whatsappOAuth = whatsappOAuth;
        this.jobsOAuth = jobsOAuth;
        this.whatsappClients = whatsappClients;
        this.jobsClients = jobsClients;
    }
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
            scopes_supported: Array.from(new Set([...whatsapp_scopes_1.WHATSAPP_SCOPES, ...jobs_mcp_scopes_1.JOBS_MCP_SCOPES, 'offline_access'])),
            service_documentation: `${base}/admin/api`,
        };
    }
    async registerClient(body) {
        const registration = await this.whatsappOAuth.registerClient(body);
        await this.ensureSharedClient(String(registration.client_id || ''));
        return registration;
    }
    async buildAuthorizationPage(input) {
        await this.ensureSharedClient(String(input.client_id || ''));
        const resource = String(input.resource || '').trim();
        if (this.isJobsResource(resource)) {
            return this.jobsOAuth.buildAuthorizationPage(input);
        }
        if (this.isWhatsAppResource(resource)) {
            return this.whatsappOAuth.buildAuthorizationPage(input);
        }
        throw new common_1.BadRequestException('resource não pertence a um MCP conhecido do PiraNegócios.');
    }
    async approveAuthorization(input) {
        await this.ensureSharedClient(String(input.client_id || ''));
        const resource = String(input.resource || '').trim();
        const redirect = this.isJobsResource(resource)
            ? await this.jobsOAuth.approveAuthorization(input)
            : this.isWhatsAppResource(resource)
                ? await this.whatsappOAuth.approveAuthorization(input)
                : null;
        if (!redirect) {
            throw new common_1.BadRequestException('resource não pertence a um MCP conhecido do PiraNegócios.');
        }
        return this.normalizeIssuer(redirect);
    }
    async exchangeToken(input) {
        await this.ensureSharedClient(String(input.client_id || ''));
        const code = String(input.code || '').trim();
        const refresh = String(input.refresh_token || '').trim();
        const resource = String(input.resource || '').trim();
        if (code.startsWith('pn_jobs_oauth_code_') ||
            refresh.startsWith('pn_jobs_oauth_rt_') ||
            this.isJobsResource(resource)) {
            return this.jobsOAuth.exchangeToken(input);
        }
        if (code.startsWith('pn_oauth_code_') ||
            refresh.startsWith('pn_oauth_rt_') ||
            this.isWhatsAppResource(resource)) {
            return this.whatsappOAuth.exchangeToken(input);
        }
        throw new common_1.BadRequestException('Não foi possível identificar o recurso MCP deste token OAuth.');
    }
    isJobsResource(resource) {
        return String(resource || '') === this.jobsOAuth.mcpResource();
    }
    isWhatsAppResource(resource) {
        try {
            const value = new URL(String(resource || ''));
            const base = new URL(this.publicBaseUrl());
            return (value.origin === base.origin &&
                /^\/api\/whatsapp\/mcp\/[^/]+\/?$/.test(value.pathname));
        }
        catch {
            return false;
        }
    }
    normalizeIssuer(redirect) {
        const url = new URL(redirect);
        url.searchParams.set('iss', this.publicBaseUrl());
        return url.toString();
    }
    async ensureSharedClient(clientId) {
        if (!clientId)
            return;
        const [whatsapp, jobs] = await Promise.all([
            this.whatsappClients.findOne({ where: { clientId, active: true } }),
            this.jobsClients.findOne({ where: { clientId, active: true } }),
        ]);
        if (whatsapp && !jobs) {
            await this.jobsClients
                .save(this.jobsClients.create({
                clientId: whatsapp.clientId,
                clientName: whatsapp.clientName,
                redirectUris: whatsapp.redirectUris,
                tokenEndpointAuthMethod: whatsapp.tokenEndpointAuthMethod,
                active: whatsapp.active,
            }))
                .catch(async () => {
                const existing = await this.jobsClients.findOne({ where: { clientId } });
                if (!existing)
                    throw new common_1.BadRequestException('Não foi possível sincronizar o cliente OAuth de vagas.');
            });
        }
        if (jobs && !whatsapp) {
            await this.whatsappClients
                .save(this.whatsappClients.create({
                clientId: jobs.clientId,
                clientName: jobs.clientName,
                redirectUris: jobs.redirectUris,
                tokenEndpointAuthMethod: jobs.tokenEndpointAuthMethod,
                active: jobs.active,
            }))
                .catch(async () => {
                const existing = await this.whatsappClients.findOne({ where: { clientId } });
                if (!existing)
                    throw new common_1.BadRequestException('Não foi possível sincronizar o cliente OAuth compartilhado.');
            });
        }
    }
};
exports.OAuthBrokerService = OAuthBrokerService;
exports.OAuthBrokerService = OAuthBrokerService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(whatsapp_oauth_entity_1.WhatsAppOAuthClient)),
    __param(3, (0, typeorm_1.InjectRepository)(jobs_oauth_entity_1.JobsOAuthClient)),
    __metadata("design:paramtypes", [whatsapp_oauth_service_1.WhatsAppOAuthService,
        jobs_oauth_service_1.JobsOAuthService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], OAuthBrokerService);
//# sourceMappingURL=oauth-broker.service.js.map