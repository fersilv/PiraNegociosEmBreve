import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { ExternalApiClient } from './entities/external-api-client.entity';
import {
  JobsOAuthClient,
  JobsOAuthCode,
  JobsOAuthToken,
} from './entities/jobs-oauth.entity';
import { JOBS_MCP_SCOPES } from './jobs-mcp.scopes';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_CODE_TTL_SECONDS = 60 * 5;

@Injectable()
export class JobsOAuthService {
  constructor(
    @InjectRepository(ExternalApiClient)
    private readonly apiClients: Repository<ExternalApiClient>,
    @InjectRepository(JobsOAuthClient)
    private readonly clients: Repository<JobsOAuthClient>,
    @InjectRepository(JobsOAuthCode)
    private readonly codes: Repository<JobsOAuthCode>,
    @InjectRepository(JobsOAuthToken)
    private readonly tokens: Repository<JobsOAuthToken>,
  ) {}

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
      scopes_supported: [...JOBS_MCP_SCOPES, 'offline_access'],
      service_documentation: `${base}/admin`,
    };
  }

  resourceMetadata() {
    return {
      resource: this.mcpResource(),
      authorization_servers: [this.issuer()],
      scopes_supported: [...JOBS_MCP_SCOPES],
      bearer_methods_supported: ['header'],
      resource_name: 'PiraNegócios Vagas',
    };
  }

  async registerClient(body: Record<string, unknown>) {
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris
          .map(String)
          .filter((value) => this.isAllowedRedirectUri(value))
      : [];
    if (!redirectUris.length) {
      throw new BadRequestException(
        'redirect_uris é obrigatório e deve conter uma URL HTTPS válida.',
      );
    }

    const client = await this.clients.save(
      this.clients.create({
        clientId: `pn_jobs_mcp_${randomBytes(24).toString('hex')}`,
        clientName:
          String(body.client_name || 'ChatGPT MCP').trim().slice(0, 180) || null,
        redirectUris: Array.from(new Set(redirectUris)),
        tokenEndpointAuthMethod: 'none',
        active: true,
      }),
    );

    return {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  async buildAuthorizationPage(query: Record<string, unknown>) {
    const request = await this.validateAuthorizationRequest(query);
    const requestedScopes = this.requestedScopes(request.scope);

    const hidden = (name: string, value: string) =>
      `<input type="hidden" name="${this.escapeHtml(name)}" value="${this.escapeHtml(value)}">`;
    const labels: Record<string, string> = {
      'jobs:read': 'Consultar e pesquisar vagas externas',
      'jobs:write': 'Cadastrar, atualizar e verificar vagas externas',
    };
    const permissions = requestedScopes
      .filter((scope) => scope !== 'offline_access')
      .map((scope) => `<li>${this.escapeHtml(labels[scope] || scope)}</li>`)
      .join('');

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autorizar ChatGPT | PiraNegócios Vagas</title>
<style>
body{font-family:Inter,system-ui,-apple-system,sans-serif;background:#f6f7f9;color:#171717;margin:0;padding:32px 16px}.card{max-width:560px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.08)}h1{font-size:24px;margin:0 0 8px}p{line-height:1.55;color:#52525b}.badge{display:inline-block;background:#f3e8ff;color:#6b21a8;padding:6px 10px;border-radius:999px;font-size:13px;font-weight:700;margin:8px 0 14px}ul{background:#f8fafc;border-radius:12px;padding:16px 16px 16px 34px;line-height:1.8}label{font-weight:700;display:block;margin:18px 0 8px}input[type=password]{width:100%;box-sizing:border-box;border:1px solid #d4d4d8;border-radius:12px;padding:13px;font-size:15px}button{width:100%;border:0;border-radius:12px;padding:14px 16px;background:#111827;color:#fff;font-size:15px;font-weight:800;cursor:pointer;margin-top:16px}.hint{font-size:13px;color:#71717a}.warn{font-size:13px;background:#fff7ed;color:#9a3412;padding:12px;border-radius:10px}</style>
</head>
<body><main class="card">
<h1>Conectar ChatGPT às vagas do PiraNegócios</h1>
<div class="badge">API de Vagas</div>
<p><strong>${this.escapeHtml(request.client.clientName || 'ChatGPT')}</strong> está solicitando acesso à API externa de vagas.</p>
<ul>${permissions || '<li>Consultar vagas</li>'}</ul>
<p class="warn">O vínculo receberá somente as permissões que também existirem na chave de API usada para autorizar.</p>
<form method="post" action="${this.publicBaseUrl()}/api/jobs/oauth/authorize">
${hidden('response_type', request.responseType)}
${hidden('client_id', request.client.clientId)}
${hidden('redirect_uri', request.redirectUri)}
${hidden('scope', requestedScopes.join(' '))}
${hidden('state', request.state)}
${hidden('code_challenge', request.codeChallenge)}
${hidden('code_challenge_method', 'S256')}
${hidden('resource', request.resource)}
<label for="api_key">Chave da API de vagas</label>
<input id="api_key" name="api_key" type="password" autocomplete="off" placeholder="pn_v1_..." required>
<p class="hint">A chave só aprova o vínculo. O ChatGPT receberá access e refresh tokens OAuth próprios.</p>
<button type="submit">Autorizar ChatGPT</button>
</form>
</main></body></html>`;
  }

  async approveAuthorization(body: Record<string, unknown>) {
    const request = await this.validateAuthorizationRequest(body);
    const apiClient = await this.validateApiKey(String(body.api_key || '').trim());
    const requested = this.requestedScopes(request.scope);
    const oauthScopes = requested.filter(
      (scope) =>
        scope !== 'offline_access' &&
        apiClient.scopes.includes(scope),
    );

    if (!oauthScopes.length) {
      throw new UnauthorizedException(
        'A chave não autoriza nenhuma das permissões solicitadas.',
      );
    }

    const rawCode = `pn_jobs_oauth_code_${randomBytes(32).toString('hex')}`;
    await this.codes.save(
      this.codes.create({
        codeHash: this.hash(rawCode),
        clientId: request.client.clientId,
        apiClientId: apiClient.id,
        redirectUri: request.redirectUri,
        resource: request.resource,
        scopes: oauthScopes,
        codeChallenge: request.codeChallenge,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
        usedAt: null,
      }),
    );

    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set('code', rawCode);
    if (request.state) redirect.searchParams.set('state', request.state);
    redirect.searchParams.set('iss', this.issuer());
    return redirect.toString();
  }

  async exchangeToken(body: Record<string, unknown>) {
    const grantType = String(body.grant_type || '');
    if (grantType === 'authorization_code') {
      return this.exchangeAuthorizationCode(body);
    }
    if (grantType === 'refresh_token') return this.exchangeRefreshToken(body);
    throw new BadRequestException('grant_type não suportado.');
  }

  async verifyAccessToken(rawToken: string) {
    if (!rawToken.startsWith('pn_jobs_oauth_at_')) {
      throw new UnauthorizedException('Access token OAuth inválido.');
    }
    const token = await this.tokens.findOne({
      where: { accessTokenHash: this.hash(rawToken) },
    });
    if (
      !token ||
      token.revokedAt ||
      token.accessExpiresAt.getTime() <= Date.now() ||
      token.resource !== this.mcpResource()
    ) {
      throw new UnauthorizedException('Access token OAuth inválido ou expirado.');
    }

    const apiClient = await this.apiClients.findOne({
      where: { id: token.apiClientId, active: true },
    });
    if (!apiClient) {
      throw new UnauthorizedException(
        'A credencial da API vinculada foi revogada ou desativada.',
      );
    }

    const scopes = token.scopes.filter((scope) => apiClient.scopes.includes(scope));
    if (!scopes.length) {
      throw new UnauthorizedException('O vínculo OAuth não possui mais permissões válidas.');
    }

    apiClient.lastUsedAt = new Date();
    void this.apiClients.save(apiClient).catch(() => undefined);
    return { token, apiClient, scopes };
  }

  private async exchangeAuthorizationCode(body: Record<string, unknown>) {
    const rawCode = String(body.code || '').trim();
    const clientId = String(body.client_id || '').trim();
    const redirectUri = String(body.redirect_uri || '').trim();
    const verifier = String(body.code_verifier || '').trim();
    const resource = String(body.resource || '').trim();
    if (!rawCode || !clientId || !redirectUri || !verifier || !resource) {
      throw new BadRequestException(
        'code, client_id, redirect_uri, code_verifier e resource são obrigatórios.',
      );
    }

    const client = await this.requireClient(clientId);
    if (!client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException('redirect_uri inválida.');
    }
    const code = await this.codes.findOne({
      where: { codeHash: this.hash(rawCode), clientId },
    });
    if (!code || code.usedAt || code.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Código de autorização inválido ou expirado.');
    }
    if (code.redirectUri !== redirectUri || code.resource !== resource) {
      throw new BadRequestException(
        'Código não pertence a este redirect_uri/resource.',
      );
    }
    if (this.pkceChallenge(verifier) !== code.codeChallenge) {
      throw new BadRequestException('Falha na validação PKCE.');
    }

    code.usedAt = new Date();
    await this.codes.save(code);
    return this.issueTokens(
      code.apiClientId,
      client.clientId,
      code.resource,
      code.scopes,
    );
  }

  private async exchangeRefreshToken(body: Record<string, unknown>) {
    const rawRefresh = String(body.refresh_token || '').trim();
    const clientId = String(body.client_id || '').trim();
    const resource = String(body.resource || '').trim();
    if (!rawRefresh || !clientId) {
      throw new BadRequestException('refresh_token e client_id são obrigatórios.');
    }
    await this.requireClient(clientId);

    const current = await this.tokens.findOne({
      where: { refreshTokenHash: this.hash(rawRefresh), clientId },
    });
    if (
      !current ||
      current.revokedAt ||
      current.refreshExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Refresh token inválido ou expirado.');
    }
    if (resource && resource !== current.resource) {
      throw new BadRequestException('resource inválido para este refresh token.');
    }

    const apiClient = await this.apiClients.findOne({
      where: { id: current.apiClientId, active: true },
    });
    if (!apiClient) {
      throw new BadRequestException('A chave de API vinculada foi revogada.');
    }
    const liveScopes = current.scopes.filter((scope) =>
      apiClient.scopes.includes(scope),
    );
    if (!liveScopes.length) {
      throw new BadRequestException('O vínculo não possui mais permissões válidas.');
    }

    current.revokedAt = new Date();
    await this.tokens.save(current);
    return this.issueTokens(
      current.apiClientId,
      clientId,
      current.resource,
      liveScopes,
    );
  }

  private async issueTokens(
    apiClientId: string,
    clientId: string,
    resource: string,
    scopes: string[],
  ) {
    const accessToken = `pn_jobs_oauth_at_${randomBytes(32).toString('hex')}`;
    const refreshToken = `pn_jobs_oauth_rt_${randomBytes(40).toString('hex')}`;
    await this.tokens.save(
      this.tokens.create({
        apiClientId,
        clientId,
        accessTokenHash: this.hash(accessToken),
        refreshTokenHash: this.hash(refreshToken),
        resource,
        scopes,
        accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        revokedAt: null,
      }),
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: [...scopes, 'offline_access'].join(' '),
    };
  }

  private async validateAuthorizationRequest(input: Record<string, unknown>) {
    const responseType = String(input.response_type || '');
    const clientId = String(input.client_id || '').trim();
    const redirectUri = String(input.redirect_uri || '').trim();
    const state = String(input.state || '');
    const scope = String(input.scope || '');
    const codeChallenge = String(input.code_challenge || '').trim();
    const codeChallengeMethod = String(input.code_challenge_method || '');
    const resource = String(input.resource || '').trim();

    if (responseType !== 'code') {
      throw new BadRequestException('response_type deve ser code.');
    }
    if (!clientId || !redirectUri || !resource) {
      throw new BadRequestException(
        'client_id, redirect_uri e resource são obrigatórios.',
      );
    }
    if (!codeChallenge || codeChallengeMethod !== 'S256') {
      throw new BadRequestException(
        'PKCE com code_challenge_method=S256 é obrigatório.',
      );
    }
    if (resource !== this.mcpResource()) {
      throw new BadRequestException('resource não é o endpoint MCP de vagas canônico.');
    }

    const client = await this.requireClient(clientId);
    if (!client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException(
        'redirect_uri não cadastrada para o cliente.',
      );
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

  private requestedScopes(scope: string) {
    const requested = String(scope || '')
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const source = requested.length
      ? requested
      : [...JOBS_MCP_SCOPES, 'offline_access'];
    const supported = new Set<string>([...JOBS_MCP_SCOPES, 'offline_access']);
    const invalid = source.filter((value) => !supported.has(value));
    if (invalid.length) {
      throw new BadRequestException(
        `Escopos OAuth inválidos: ${invalid.join(', ')}`,
      );
    }
    return Array.from(new Set(source));
  }

  private async validateApiKey(rawKey: string) {
    if (!rawKey.startsWith('pn_v1_') || rawKey.length < 40) {
      throw new UnauthorizedException('Chave da API de vagas inválida.');
    }
    const client = await this.apiClients.findOne({
      where: { keyPrefix: rawKey.slice(0, 20), active: true },
    });
    const supplied = Buffer.from(this.hash(rawKey));
    const expected = Buffer.from(client?.keyHash || '0'.repeat(64));
    if (
      !client ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new UnauthorizedException(
        'Chave da API de vagas inválida ou revogada.',
      );
    }
    client.lastUsedAt = new Date();
    void this.apiClients.save(client).catch(() => undefined);
    return client;
  }

  private async requireClient(clientId: string) {
    const client = await this.clients.findOne({
      where: { clientId, active: true },
    });
    if (!client) throw new BadRequestException('OAuth client inválido.');
    return client;
  }

  private isAllowedRedirectUri(value: string) {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname))
      );
    } catch {
      return false;
    }
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private pkceChallenge(verifier: string) {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  private escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
