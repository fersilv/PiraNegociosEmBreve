import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';
import {
  WhatsAppOAuthClient,
  WhatsAppOAuthCode,
  WhatsAppOAuthToken,
} from './entities/whatsapp-oauth.entity';
import { WHATSAPP_SCOPES } from './whatsapp.scopes';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_CODE_TTL_SECONDS = 5 * 60;

@Injectable()
export class WhatsAppOAuthService {
  constructor(
    @InjectRepository(WhatsAppInstance)
    private readonly instances: Repository<WhatsAppInstance>,
    @InjectRepository(WhatsAppApiKey)
    private readonly apiKeys: Repository<WhatsAppApiKey>,
    @InjectRepository(WhatsAppOAuthClient)
    private readonly clients: Repository<WhatsAppOAuthClient>,
    @InjectRepository(WhatsAppOAuthCode)
    private readonly codes: Repository<WhatsAppOAuthCode>,
    @InjectRepository(WhatsAppOAuthToken)
    private readonly tokens: Repository<WhatsAppOAuthToken>,
  ) {}

  publicBaseUrl() {
    return String(process.env.PUBLIC_BASE_URL || 'https://piranegocios.com.br').replace(/\/+$/, '');
  }

  mcpResource(instanceId: string) {
    return `${this.publicBaseUrl()}/api/whatsapp/mcp/${encodeURIComponent(instanceId)}`;
  }

  resourceMetadataUrl(instanceId: string) {
    return `${this.publicBaseUrl()}/api/whatsapp/oauth/resource/${encodeURIComponent(instanceId)}`;
  }

  authorizationServerMetadata() {
    const base = this.publicBaseUrl();
    return {
      issuer: base,
      authorization_endpoint: `${base}/api/whatsapp/oauth/authorize`,
      token_endpoint: `${base}/api/whatsapp/oauth/token`,
      registration_endpoint: `${base}/api/whatsapp/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [...WHATSAPP_SCOPES, 'offline_access'],
      service_documentation: `${base}/admin/whatsapp`,
    };
  }

  async resourceMetadata(instanceId: string) {
    const instance = await this.instances.findOne({ where: { id: instanceId, active: true } });
    if (!instance) throw new NotFoundException('Número do WhatsApp não encontrado ou desativado.');
    return {
      resource: this.mcpResource(instanceId),
      authorization_servers: [this.publicBaseUrl()],
      scopes_supported: instance.allowedScopes.filter((scope) =>
        (WHATSAPP_SCOPES as readonly string[]).includes(scope),
      ),
      bearer_methods_supported: ['header'],
      resource_name: `PiraNegócios WhatsApp - ${instance.name}`,
    };
  }

  async registerClient(body: Record<string, unknown>) {
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.map(String).filter((value) => this.isAllowedRedirectUri(value))
      : [];
    if (!redirectUris.length) {
      throw new BadRequestException('redirect_uris é obrigatório e deve conter uma URL HTTPS válida.');
    }

    const client = await this.clients.save(
      this.clients.create({
        clientId: `pn_mcp_${randomBytes(24).toString('hex')}`,
        clientName: String(body.client_name || 'ChatGPT MCP').trim().slice(0, 180) || null,
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
    const instance = await this.requireInstanceFromResource(request.resource);
    const requestedScopes = this.requestedScopes(request.scope, instance.allowedScopes);
    const client = request.client;

    const hidden = (name: string, value: string) =>
      `<input type="hidden" name="${this.escapeHtml(name)}" value="${this.escapeHtml(value)}">`;
    const scopeLabels: Record<string, string> = {
      'connection:read': 'Consultar estado da conexão',
      'messages:read': 'Ler histórico de mensagens',
      'messages:send': 'Enviar mensagens',
      'contacts:read': 'Consultar contatos',
      'contacts:write': 'Salvar contatos',
      'groups:read': 'Consultar grupos',
      'groups:send': 'Enviar mensagens em grupos',
      'channels:read': 'Consultar canais',
      'channels:publish': 'Publicar em canais',
      'status:publish': 'Publicar status',
    };
    const permissions = requestedScopes
      .filter((scope) => scope !== 'offline_access')
      .map((scope) => `<li>${this.escapeHtml(scopeLabels[scope] || scope)}</li>`)
      .join('');

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autorizar ChatGPT | PiraNegócios</title>
<style>
body{font-family:Inter,system-ui,-apple-system,sans-serif;background:#f6f7f9;color:#171717;margin:0;padding:32px 16px}.card{max-width:560px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.08)}h1{font-size:24px;margin:0 0 8px}p{line-height:1.55;color:#52525b}.badge{display:inline-block;background:#eefbf4;color:#166534;padding:6px 10px;border-radius:999px;font-size:13px;font-weight:700;margin:8px 0 14px}ul{background:#f8fafc;border-radius:12px;padding:16px 16px 16px 34px;line-height:1.8}label{font-weight:700;display:block;margin:18px 0 8px}input[type=password]{width:100%;box-sizing:border-box;border:1px solid #d4d4d8;border-radius:12px;padding:13px;font-size:15px}button{width:100%;border:0;border-radius:12px;padding:14px 16px;background:#111827;color:#fff;font-size:15px;font-weight:800;cursor:pointer;margin-top:16px}.hint{font-size:13px;color:#71717a}.warn{font-size:13px;background:#fff7ed;color:#9a3412;padding:12px;border-radius:10px}</style>
</head>
<body><main class="card">
<h1>Conectar ChatGPT ao WhatsApp</h1>
<div class="badge">${this.escapeHtml(instance.name)}</div>
<p><strong>${this.escapeHtml(client.clientName || 'ChatGPT')}</strong> está solicitando acesso a este número do PiraNegócios.</p>
<ul>${permissions || '<li>Acesso básico à conexão</li>'}</ul>
<p class="warn">Use uma chave criada para este número. As permissões OAuth nunca ultrapassam os escopos dessa chave.</p>
<form method="post" action="${this.publicBaseUrl()}/api/whatsapp/oauth/authorize">
${hidden('response_type', request.responseType)}
${hidden('client_id', client.clientId)}
${hidden('redirect_uri', request.redirectUri)}
${hidden('scope', requestedScopes.join(' '))}
${hidden('state', request.state)}
${hidden('code_challenge', request.codeChallenge)}
${hidden('code_challenge_method', 'S256')}
${hidden('resource', request.resource)}
<label for="api_key">Chave de autorização do WhatsApp</label>
<input id="api_key" name="api_key" type="password" autocomplete="off" placeholder="pn_wa_..." required>
<p class="hint">A chave é usada apenas para aprovar este vínculo. O ChatGPT receberá tokens OAuth próprios e renováveis.</p>
<button type="submit">Autorizar ChatGPT</button>
</form>
</main></body></html>`;
  }

  async approveAuthorization(body: Record<string, unknown>) {
    const request = await this.validateAuthorizationRequest(body);
    const instance = await this.requireInstanceFromResource(request.resource);
    const rawKey = String(body.api_key || '').trim();
    const key = await this.validateApiKey(instance.id, rawKey);
    const requested = this.requestedScopes(request.scope, instance.allowedScopes);
    const oauthScopes = requested.filter((scope) => scope !== 'offline_access');

    const forbidden = oauthScopes.filter(
      (scope) => !instance.allowedScopes.includes(scope) || !key.scopes.includes(scope),
    );
    if (forbidden.length) {
      throw new UnauthorizedException(`A chave não autoriza os escopos: ${forbidden.join(', ')}`);
    }

    const rawCode = `pn_oauth_code_${randomBytes(32).toString('hex')}`;
    await this.codes.save(
      this.codes.create({
        codeHash: this.hash(rawCode),
        clientId: request.client.clientId,
        instanceId: instance.id,
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
    redirect.searchParams.set('iss', this.publicBaseUrl());
    return redirect.toString();
  }

  async exchangeToken(body: Record<string, unknown>) {
    const grantType = String(body.grant_type || '');
    if (grantType === 'authorization_code') return this.exchangeAuthorizationCode(body);
    if (grantType === 'refresh_token') return this.exchangeRefreshToken(body);
    throw new BadRequestException('grant_type não suportado.');
  }

  async verifyAccessToken(instanceId: string, rawToken: string) {
    if (!rawToken.startsWith('pn_oauth_at_')) throw new UnauthorizedException('Access token OAuth inválido.');
    const token = await this.tokens.findOne({ where: { accessTokenHash: this.hash(rawToken) } });
    if (!token || token.revokedAt || token.accessExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Access token OAuth inválido ou expirado.');
    }
    if (token.instanceId !== instanceId || token.resource !== this.mcpResource(instanceId)) {
      throw new UnauthorizedException('Este token não foi emitido para este recurso MCP.');
    }
    const instance = await this.instances.findOne({ where: { id: instanceId, active: true } });
    if (!instance) throw new UnauthorizedException('Número do WhatsApp desativado ou inexistente.');
    return { token, instance, scopes: token.scopes };
  }

  private async exchangeAuthorizationCode(body: Record<string, unknown>) {
    const rawCode = String(body.code || '').trim();
    const clientId = String(body.client_id || '').trim();
    const redirectUri = String(body.redirect_uri || '').trim();
    const verifier = String(body.code_verifier || '').trim();
    const resource = String(body.resource || '').trim();
    if (!rawCode || !clientId || !redirectUri || !verifier || !resource) {
      throw new BadRequestException('code, client_id, redirect_uri, code_verifier e resource são obrigatórios.');
    }

    const client = await this.requireClient(clientId);
    if (!client.redirectUris.includes(redirectUri)) throw new BadRequestException('redirect_uri inválida.');
    const code = await this.codes.findOne({ where: { codeHash: this.hash(rawCode), clientId } });
    if (!code || code.usedAt || code.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Código de autorização inválido ou expirado.');
    }
    if (code.redirectUri !== redirectUri || code.resource !== resource) {
      throw new BadRequestException('Código não pertence a este redirect_uri/resource.');
    }
    if (this.pkceChallenge(verifier) !== code.codeChallenge) {
      throw new BadRequestException('Falha na validação PKCE.');
    }

    code.usedAt = new Date();
    await this.codes.save(code);
    return this.issueTokens(code.instanceId, client.clientId, code.resource, code.scopes);
  }

  private async exchangeRefreshToken(body: Record<string, unknown>) {
    const rawRefresh = String(body.refresh_token || '').trim();
    const clientId = String(body.client_id || '').trim();
    const resource = String(body.resource || '').trim();
    if (!rawRefresh || !clientId) throw new BadRequestException('refresh_token e client_id são obrigatórios.');
    await this.requireClient(clientId);

    const current = await this.tokens.findOne({ where: { refreshTokenHash: this.hash(rawRefresh), clientId } });
    if (!current || current.revokedAt || current.refreshExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Refresh token inválido ou expirado.');
    }
    if (resource && resource !== current.resource) throw new BadRequestException('resource inválido para este refresh token.');

    current.revokedAt = new Date();
    await this.tokens.save(current);
    return this.issueTokens(current.instanceId, clientId, current.resource, current.scopes);
  }

  private async issueTokens(instanceId: string, clientId: string, resource: string, scopes: string[]) {
    const accessToken = `pn_oauth_at_${randomBytes(32).toString('hex')}`;
    const refreshToken = `pn_oauth_rt_${randomBytes(40).toString('hex')}`;
    await this.tokens.save(
      this.tokens.create({
        instanceId,
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

    if (responseType !== 'code') throw new BadRequestException('response_type deve ser code.');
    if (!clientId || !redirectUri || !resource) throw new BadRequestException('client_id, redirect_uri e resource são obrigatórios.');
    if (!codeChallenge || codeChallengeMethod !== 'S256') {
      throw new BadRequestException('PKCE com code_challenge_method=S256 é obrigatório.');
    }

    const client = await this.requireClient(clientId);
    if (!client.redirectUris.includes(redirectUri)) throw new BadRequestException('redirect_uri não cadastrada para o cliente.');
    await this.requireInstanceFromResource(resource);
    return { responseType, client, redirectUri, state, scope, codeChallenge, resource };
  }

  private async requireClient(clientId: string) {
    const client = await this.clients.findOne({ where: { clientId, active: true } });
    if (!client) throw new BadRequestException('OAuth client inválido.');
    return client;
  }

  private async requireInstanceFromResource(resource: string) {
    let url: URL;
    try {
      url = new URL(resource);
    } catch {
      throw new BadRequestException('resource inválido.');
    }
    const base = new URL(this.publicBaseUrl());
    if (url.origin !== base.origin) throw new BadRequestException('resource pertence a outro domínio.');
    const match = url.pathname.match(/^\/api\/whatsapp\/mcp\/([^/]+)\/?$/);
    if (!match) throw new BadRequestException('resource não é um endpoint MCP do WhatsApp.');
    const instanceId = decodeURIComponent(match[1]);
    const instance = await this.instances.findOne({ where: { id: instanceId, active: true } });
    if (!instance || resource !== this.mcpResource(instanceId)) {
      throw new BadRequestException('resource MCP inexistente ou não canônico.');
    }
    return instance;
  }

  private requestedScopes(scope: string, fallback: string[]) {
    const requested = String(scope || '')
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const source = requested.length ? requested : [...fallback, 'offline_access'];
    const supported = new Set<string>([...WHATSAPP_SCOPES, 'offline_access']);
    const invalid = source.filter((value) => !supported.has(value));
    if (invalid.length) throw new BadRequestException(`Escopos OAuth inválidos: ${invalid.join(', ')}`);
    return Array.from(new Set(source));
  }

  private async validateApiKey(instanceId: string, rawKey: string) {
    if (!rawKey.startsWith('pn_wa_') || rawKey.length < 45) {
      throw new UnauthorizedException('Chave de autorização do WhatsApp inválida.');
    }
    const key = await this.apiKeys.findOne({ where: { keyPrefix: rawKey.slice(0, 24), active: true } });
    const supplied = Buffer.from(this.hash(rawKey));
    const expected = Buffer.from(key?.keyHash || '0'.repeat(64));
    if (!key || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Chave de autorização do WhatsApp inválida ou revogada.');
    }
    if (key.instanceId !== instanceId) throw new UnauthorizedException('Esta chave pertence a outro número.');
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Esta chave expirou.');
    key.lastUsedAt = new Date();
    void this.apiKeys.save(key).catch(() => undefined);
    return key;
  }

  private isAllowedRedirectUri(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
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
