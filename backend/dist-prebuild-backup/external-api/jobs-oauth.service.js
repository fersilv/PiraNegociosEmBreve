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
exports.JobsOAuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const external_api_client_entity_1 = require("./entities/external-api-client.entity");
const jobs_oauth_entity_1 = require("./entities/jobs-oauth.entity");
const jobs_mcp_scopes_1 = require("./jobs-mcp.scopes");
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_CODE_TTL_SECONDS = 60 * 5;
let JobsOAuthService = class JobsOAuthService {
    apiClients;
    clients;
    codes;
    tokens;
    constructor(apiClients, clients, codes, tokens) {
        this.apiClients = apiClients;
        this.clients = clients;
        this.codes = codes;
        this.tokens = tokens;
    }
    publicBaseUrl() {
        return String(process.env.PUBLIC_BASE_URL || 'https://piranegocios.com.br').replace(/\/+$/, '');
    }
    issuer() {
        return `${this.publicBaseUrl()}/jobs`;
    }
    mcpResource() {
        return `${this.publicBaseUrl()}/api/jobs/mcp`;
    }
    resourceMetadataUrl() {
        return `${this.publicBaseUrl()}/api/jobs/oauth/resource`;
    }
    authorizationServerMetadata() {
        const base = this.publicBaseUrl();
        return {
            issuer: this.issuer(),
            authorization_endpoint: `${base}/api/jobs/oauth/authorize`,
            token_endpoint: `${base}/api/jobs/oauth/token`,
            registration_endpoint: `${base}/api/jobs/oauth/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['none'],
            scopes_supported: [...jobs_mcp_scopes_1.JOBS_MCP_SCOPES, 'offline_access'],
            service_documentation: `${base}/admin`,
        };
    }
    resourceMetadata() {
        return {
            resource: this.mcpResource(),
            authorization_servers: [this.issuer()],
            scopes_supported: [...jobs_mcp_scopes_1.JOBS_MCP_SCOPES],
            bearer_methods_supported: ['header'],
            resource_name: 'PiraNegócios Operações',
        };
    }
    async registerClient(body) {
        const redirectUris = Array.isArray(body.redirect_uris)
            ? body.redirect_uris
                .map(String)
                .filter((value) => this.isAllowedRedirectUri(value))
            : [];
        if (!redirectUris.length) {
            throw new common_1.BadRequestException('redirect_uris é obrigatório e deve conter uma URL HTTPS válida.');
        }
        const client = await this.clients.save(this.clients.create({
            clientId: `pn_jobs_mcp_${(0, crypto_1.randomBytes)(24).toString('hex')}`,
            clientName: String(body.client_name || 'ChatGPT MCP').trim().slice(0, 180) || null,
            redirectUris: Array.from(new Set(redirectUris)),
            tokenEndpointAuthMethod: 'none',
            active: true,
        }));
        return {
            client_id: client.clientId,
            client_name: client.clientName,
            redirect_uris: client.redirectUris,
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
        };
    }
    async buildAuthorizationPage(query) {
        const request = await this.validateAuthorizationRequest(query);
        const requestedScopes = this.requestedScopes(request.scope);
        const labels = Object.fromEntries(jobs_mcp_scopes_1.JOBS_CAPABILITIES.map((capability) => [capability.scope, capability.label]));
        const hidden = (name, value) => `<input type="hidden" name="${this.escapeHtml(name)}" value="${this.escapeHtml(value)}">`;
        const permissions = requestedScopes
            .filter((scope) => scope !== 'offline_access')
            .map((scope) => `<li>${this.escapeHtml(labels[scope] || scope)}</li>`)
            .join('');
        return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autorizar MCP | PiraNegócios</title>
<style>
body{font-family:Inter,system-ui,-apple-system,sans-serif;background:#f6f7f9;color:#171717;margin:0;padding:32px 16px}.card{max-width:620px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.08)}h1{font-size:24px;margin:0 0 8px}p{line-height:1.55;color:#52525b}.badge{display:inline-block;background:#f3e8ff;color:#6b21a8;padding:6px 10px;border-radius:999px;font-size:13px;font-weight:700;margin:8px 0 14px}ul{background:#f8fafc;border-radius:12px;padding:16px 16px 16px 34px;line-height:1.8;max-height:280px;overflow:auto}label{font-weight:700;display:block;margin:18px 0 8px}input[type=password]{width:100%;box-sizing:border-box;border:1px solid #d4d4d8;border-radius:12px;padding:13px;font-size:15px}button{width:100%;border:0;border-radius:12px;padding:14px 16px;background:#111827;color:#fff;font-size:15px;font-weight:800;cursor:pointer;margin-top:16px}.hint{font-size:13px;color:#71717a}.warn{font-size:13px;background:#fff7ed;color:#9a3412;padding:12px;border-radius:10px}</style>
</head>
<body><main class="card">
<h1>Conectar ao MCP do PiraNegócios</h1>
<div class="badge">Permissões granulares</div>
<p><strong>${this.escapeHtml(request.client.clientName || 'Cliente MCP')}</strong> está solicitando acesso às ferramentas externas do PiraNegócios.</p>
<ul>${permissions || '<li>Nenhuma ferramenta solicitada</li>'}</ul>
<p class="warn">A conexão receberá somente as permissões que também estiverem liberadas na chave MCP informada abaixo. Chaves das APIs REST não autorizam este MCP.</p>
<form method="post" action="${this.publicBaseUrl()}/api/jobs/oauth/authorize">
${hidden('response_type', request.responseType)}
${hidden('client_id', request.client.clientId)}
${hidden('redirect_uri', request.redirectUri)}
${hidden('scope', requestedScopes.join(' '))}
${hidden('state', request.state)}
${hidden('code_challenge', request.codeChallenge)}
${hidden('code_challenge_method', 'S256')}
${hidden('resource', request.resource)}
<label for="api_key">Chave exclusiva do MCP</label>
<input id="api_key" name="api_key" type="password" autocomplete="off" placeholder="pn_v1_..." required>
<p class="hint">A chave serve para autorizar o vínculo. Depois disso, o cliente usa access token e refresh token OAuth próprios.</p>
<button type="submit">Autorizar conexão</button>
</form>
</main></body></html>`;
    }
    async approveAuthorization(body) {
        const request = await this.validateAuthorizationRequest(body);
        const apiClient = await this.validateApiKey(String(body.api_key || '').trim());
        const requested = this.requestedScopes(request.scope);
        const effectiveScopes = this.effectiveClientScopes(apiClient);
        const oauthScopes = requested.filter((scope) => scope !== 'offline_access' && effectiveScopes.has(scope));
        if (!oauthScopes.length) {
            throw new common_1.UnauthorizedException('A chave MCP não autoriza nenhuma das permissões solicitadas.');
        }
        const rawCode = `pn_jobs_oauth_code_${(0, crypto_1.randomBytes)(32).toString('hex')}`;
        await this.codes.save(this.codes.create({
            codeHash: this.hash(rawCode),
            clientId: request.client.clientId,
            apiClientId: apiClient.id,
            redirectUri: request.redirectUri,
            resource: request.resource,
            scopes: oauthScopes,
            codeChallenge: request.codeChallenge,
            expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
            usedAt: null,
        }));
        const redirect = new URL(request.redirectUri);
        redirect.searchParams.set('code', rawCode);
        if (request.state)
            redirect.searchParams.set('state', request.state);
        redirect.searchParams.set('iss', this.issuer());
        return redirect.toString();
    }
    async exchangeToken(body) {
        const grantType = String(body.grant_type || '');
        if (grantType === 'authorization_code') {
            return this.exchangeAuthorizationCode(body);
        }
        if (grantType === 'refresh_token')
            return this.exchangeRefreshToken(body);
        throw new common_1.BadRequestException('grant_type não suportado.');
    }
    async verifyAccessToken(rawToken) {
        if (!rawToken.startsWith('pn_jobs_oauth_at_')) {
            throw new common_1.UnauthorizedException('Access token OAuth inválido.');
        }
        const token = await this.tokens.findOne({
            where: { accessTokenHash: this.hash(rawToken) },
        });
        if (!token ||
            token.revokedAt ||
            token.accessExpiresAt.getTime() <= Date.now() ||
            token.resource !== this.mcpResource()) {
            throw new common_1.UnauthorizedException('Access token OAuth inválido ou expirado.');
        }
        const apiClient = await this.apiClients.findOne({
            where: { id: token.apiClientId, active: true },
        });
        if (!apiClient || apiClient.audience !== 'mcp') {
            throw new common_1.UnauthorizedException('A chave MCP vinculada foi revogada, desativada ou não possui a audiência correta.');
        }
        const effectiveScopes = this.effectiveClientScopes(apiClient);
        const scopes = token.scopes.filter((scope) => effectiveScopes.has(scope));
        if (!scopes.length) {
            throw new common_1.UnauthorizedException('O vínculo OAuth não possui mais permissões válidas.');
        }
        apiClient.lastUsedAt = new Date();
        void this.apiClients.save(apiClient).catch(() => undefined);
        return { token, apiClient, scopes };
    }
    async exchangeAuthorizationCode(body) {
        const rawCode = String(body.code || '').trim();
        const clientId = String(body.client_id || '').trim();
        const redirectUri = String(body.redirect_uri || '').trim();
        const verifier = String(body.code_verifier || '').trim();
        const resource = String(body.resource || '').trim();
        if (!rawCode || !clientId || !redirectUri || !verifier || !resource) {
            throw new common_1.BadRequestException('code, client_id, redirect_uri, code_verifier e resource são obrigatórios.');
        }
        const client = await this.requireClient(clientId);
        if (!client.redirectUris.includes(redirectUri)) {
            throw new common_1.BadRequestException('redirect_uri inválida.');
        }
        const code = await this.codes.findOne({
            where: { codeHash: this.hash(rawCode), clientId },
        });
        if (!code || code.usedAt || code.expiresAt.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('Código de autorização inválido ou expirado.');
        }
        if (code.redirectUri !== redirectUri || code.resource !== resource) {
            throw new common_1.BadRequestException('Código não pertence a este redirect_uri/resource.');
        }
        if (this.pkceChallenge(verifier) !== code.codeChallenge) {
            throw new common_1.BadRequestException('Falha na validação PKCE.');
        }
        code.usedAt = new Date();
        await this.codes.save(code);
        return this.issueTokens(code.apiClientId, client.clientId, code.resource, code.scopes);
    }
    async exchangeRefreshToken(body) {
        const rawRefresh = String(body.refresh_token || '').trim();
        const clientId = String(body.client_id || '').trim();
        const resource = String(body.resource || '').trim();
        if (!rawRefresh || !clientId) {
            throw new common_1.BadRequestException('refresh_token e client_id são obrigatórios.');
        }
        await this.requireClient(clientId);
        const current = await this.tokens.findOne({
            where: { refreshTokenHash: this.hash(rawRefresh), clientId },
        });
        if (!current ||
            current.revokedAt ||
            current.refreshExpiresAt.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('Refresh token inválido ou expirado.');
        }
        if (resource && resource !== current.resource) {
            throw new common_1.BadRequestException('resource inválido para este refresh token.');
        }
        const apiClient = await this.apiClients.findOne({
            where: { id: current.apiClientId, active: true },
        });
        if (!apiClient || apiClient.audience !== 'mcp') {
            throw new common_1.BadRequestException('A chave MCP vinculada foi revogada ou é inválida.');
        }
        const effectiveScopes = this.effectiveClientScopes(apiClient);
        const liveScopes = current.scopes.filter((scope) => effectiveScopes.has(scope));
        if (!liveScopes.length) {
            throw new common_1.BadRequestException('O vínculo não possui mais permissões válidas.');
        }
        current.revokedAt = new Date();
        await this.tokens.save(current);
        return this.issueTokens(current.apiClientId, clientId, current.resource, liveScopes);
    }
    async issueTokens(apiClientId, clientId, resource, scopes) {
        const accessToken = `pn_jobs_oauth_at_${(0, crypto_1.randomBytes)(32).toString('hex')}`;
        const refreshToken = `pn_jobs_oauth_rt_${(0, crypto_1.randomBytes)(40).toString('hex')}`;
        await this.tokens.save(this.tokens.create({
            apiClientId,
            clientId,
            accessTokenHash: this.hash(accessToken),
            refreshTokenHash: this.hash(refreshToken),
            resource,
            scopes,
            accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
            refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
            revokedAt: null,
        }));
        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: ACCESS_TOKEN_TTL_SECONDS,
            refresh_token: refreshToken,
            scope: [...scopes, 'offline_access'].join(' '),
        };
    }
    async validateAuthorizationRequest(input) {
        const responseType = String(input.response_type || '');
        const clientId = String(input.client_id || '').trim();
        const redirectUri = String(input.redirect_uri || '').trim();
        const state = String(input.state || '');
        const scope = String(input.scope || '');
        const codeChallenge = String(input.code_challenge || '').trim();
        const codeChallengeMethod = String(input.code_challenge_method || '');
        const resource = String(input.resource || '').trim();
        if (responseType !== 'code') {
            throw new common_1.BadRequestException('response_type deve ser code.');
        }
        if (!clientId || !redirectUri || !resource) {
            throw new common_1.BadRequestException('client_id, redirect_uri e resource são obrigatórios.');
        }
        if (!codeChallenge || codeChallengeMethod !== 'S256') {
            throw new common_1.BadRequestException('PKCE com code_challenge_method=S256 é obrigatório.');
        }
        if (resource !== this.mcpResource()) {
            throw new common_1.BadRequestException('resource não é o endpoint MCP canônico.');
        }
        const client = await this.requireClient(clientId);
        if (!client.redirectUris.includes(redirectUri)) {
            throw new common_1.BadRequestException('redirect_uri não cadastrada para o cliente.');
        }
        return {
            responseType,
            client,
            redirectUri,
            state,
            scope,
            codeChallenge,
            resource,
        };
    }
    requestedScopes(scope) {
        const requested = String(scope || '')
            .split(/\s+/)
            .map((value) => value.trim())
            .filter(Boolean);
        const source = requested.length
            ? requested
            : [...jobs_mcp_scopes_1.JOBS_MCP_SCOPES, 'offline_access'];
        const supported = new Set([...jobs_mcp_scopes_1.JOBS_MCP_SCOPES, 'offline_access']);
        const invalid = source.filter((value) => !supported.has(value));
        if (invalid.length) {
            throw new common_1.BadRequestException(`Escopos OAuth inválidos: ${invalid.join(', ')}`);
        }
        return Array.from(new Set(source));
    }
    async validateApiKey(rawKey) {
        if (!rawKey.startsWith('pn_v1_') || rawKey.length < 40) {
            throw new common_1.UnauthorizedException('Chave MCP inválida.');
        }
        const client = await this.apiClients.findOne({
            where: { keyPrefix: rawKey.slice(0, 20), active: true },
        });
        const supplied = Buffer.from(this.hash(rawKey));
        const expected = Buffer.from(client?.keyHash || '0'.repeat(64));
        if (!client ||
            client.audience !== 'mcp' ||
            supplied.length !== expected.length ||
            !(0, crypto_1.timingSafeEqual)(supplied, expected)) {
            throw new common_1.UnauthorizedException('Chave MCP inválida, revogada ou pertencente a outro tipo de integração.');
        }
        client.lastUsedAt = new Date();
        void this.apiClients.save(client).catch(() => undefined);
        return client;
    }
    effectiveClientScopes(client) {
        return new Set([
            ...(client.scopes || []),
            ...(0, jobs_mcp_scopes_1.expandLegacyJobsScopes)(client.scopes || []),
        ]);
    }
    async requireClient(clientId) {
        const client = await this.clients.findOne({
            where: { clientId, active: true },
        });
        if (!client)
            throw new common_1.BadRequestException('OAuth client inválido.');
        return client;
    }
    isAllowedRedirectUri(value) {
        try {
            const url = new URL(value);
            return (url.protocol === 'https:' ||
                (url.protocol === 'http:' &&
                    ['localhost', '127.0.0.1'].includes(url.hostname)));
        }
        catch {
            return false;
        }
    }
    hash(value) {
        return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
    }
    pkceChallenge(verifier) {
        return (0, crypto_1.createHash)('sha256').update(verifier).digest('base64url');
    }
    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};
exports.JobsOAuthService = JobsOAuthService;
exports.JobsOAuthService = JobsOAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(external_api_client_entity_1.ExternalApiClient)),
    __param(1, (0, typeorm_1.InjectRepository)(jobs_oauth_entity_1.JobsOAuthClient)),
    __param(2, (0, typeorm_1.InjectRepository)(jobs_oauth_entity_1.JobsOAuthCode)),
    __param(3, (0, typeorm_1.InjectRepository)(jobs_oauth_entity_1.JobsOAuthToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], JobsOAuthService);
//# sourceMappingURL=jobs-oauth.service.js.map