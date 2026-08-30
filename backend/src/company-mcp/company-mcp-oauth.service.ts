import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';
import {
  COMPANY_MCP_CAPABILITIES,
  COMPANY_MCP_SCOPES,
  DEFAULT_COMPANY_MCP_SCOPES,
  companyScopeCapability,
} from './company-mcp.scopes';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_CODE_TTL_SECONDS = 60 * 5;
const CONNECTION_CODE_TTL_SECONDS = 60 * 10;

type CompanyPermissions = {
  companyProfile: boolean;
  marketplace: boolean;
  recruitment: boolean;
  finance: boolean;
  team: boolean;
};

type CompanyAccess = {
  companyId: string;
  companyName: string;
  userId: string;
  elevated: boolean;
  permissions: CompanyPermissions;
};

@Injectable()
export class CompanyMcpOAuthService {
  constructor(private readonly dataSource: DataSource) {}

  publicBaseUrl() {
    return String(process.env.PUBLIC_BASE_URL || 'https://piranegocios.com.br').replace(/\/+$/, '');
  }

  issuer() {
    return `${this.publicBaseUrl()}/company`;
  }

  mcpResource() {
    return `${this.publicBaseUrl()}/api/company/mcp`;
  }

  authorizationServerMetadata() {
    const base = this.publicBaseUrl();
    return {
      issuer: this.issuer(),
      authorization_endpoint: `${base}/api/company/oauth/authorize`,
      token_endpoint: `${base}/api/company/oauth/token`,
      registration_endpoint: `${base}/api/company/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [...COMPANY_MCP_SCOPES, 'offline_access'],
      service_documentation: `${base}/docs/company-mcp`,
    };
  }

  resourceMetadata() {
    return {
      resource: this.mcpResource(),
      authorization_servers: [this.issuer()],
      scopes_supported: [...COMPANY_MCP_SCOPES],
      bearer_methods_supported: ['header'],
      resource_name: 'PiraNegócios Business',
    };
  }

  async registerClient(body: Record<string, unknown>) {
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.map(String).filter((value) => this.isAllowedRedirectUri(value))
      : [];
    if (!redirectUris.length) {
      throw new BadRequestException('redirect_uris é obrigatório e precisa conter uma URL HTTPS válida.');
    }
    const clientId = `pn_company_mcp_${randomBytes(24).toString('hex')}`;
    const clientName = String(body.client_name || 'Cliente MCP empresarial').trim().slice(0, 180) || null;
    await this.dataSource.query(
      `INSERT INTO company_mcp_oauth_clients(id,"clientId","clientName","redirectUris",active)
       VALUES($1,$2,$3,$4::jsonb,true)`,
      [randomUUID(), clientId, clientName, JSON.stringify(Array.from(new Set(redirectUris)))],
    );
    return {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: Array.from(new Set(redirectUris)),
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  async createConnectionCode(userId: string, requestedScopes?: unknown) {
    const access = await this.resolveCompanyAccess(userId);
    const requested = this.normalizeScopes(requestedScopes, DEFAULT_COMPANY_MCP_SCOPES);
    const scopes = this.liveScopes(access, requested);
    if (!scopes.length) throw new ForbiddenException('Seu perfil não possui permissões empresariais compatíveis com este MCP.');

    const rawCode = `pn_company_connect_${randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + CONNECTION_CODE_TTL_SECONDS * 1000);
    await this.dataSource.query(
      `INSERT INTO company_mcp_connection_codes(id,"codeHash","companyId","authorizedByUserId",scopes,"expiresAt")
       VALUES($1,$2,$3::uuid,$4,$5::jsonb,$6)`,
      [randomUUID(), this.hash(rawCode), access.companyId, access.userId, JSON.stringify(scopes), expiresAt],
    );
    return {
      connectionCode: rawCode,
      company: { id: access.companyId, name: access.companyName },
      scopes,
      expiresAt: expiresAt.toISOString(),
      expiresIn: CONNECTION_CODE_TTL_SECONDS,
      oneTime: true,
    };
  }

  async buildAuthorizationPage(query: Record<string, unknown>) {
    const request = await this.validateAuthorizationRequest(query);
    const requestedScopes = this.requestedOAuthScopes(request.scope);
    const labels = Object.fromEntries(COMPANY_MCP_CAPABILITIES.map((item) => [item.scope, item.label]));
    const hidden = (name: string, value: string) => `<input type="hidden" name="${this.escapeHtml(name)}" value="${this.escapeHtml(value)}">`;
    const permissions = requestedScopes
      .filter((scope) => scope !== 'offline_access')
      .map((scope) => `<li>${this.escapeHtml(labels[scope] || scope)}</li>`)
      .join('');

    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar agente à empresa | PiraNegócios</title>
<style>body{font-family:Inter,system-ui,-apple-system,sans-serif;background:#f5f4ef;color:#1c211e;margin:0;padding:28px 16px}.card{max-width:650px;margin:36px auto;background:#fff;border:1px solid #e7e4dc;border-radius:24px;padding:30px;box-shadow:0 20px 60px rgba(30,35,31,.09)}h1{font-size:26px;margin:0 0 8px}p{line-height:1.55;color:#61665f}.badge{display:inline-block;background:#edf6f1;color:#17604d;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;margin:8px 0 14px}ul{background:#faf9f6;border-radius:14px;padding:16px 18px 16px 36px;line-height:1.8;max-height:280px;overflow:auto}label{font-weight:800;display:block;margin:18px 0 8px}input{width:100%;box-sizing:border-box;border:1px solid #d9d6cd;border-radius:12px;padding:13px;font-size:15px}button{width:100%;border:0;border-radius:12px;padding:14px 16px;background:#163f37;color:#fff;font-size:15px;font-weight:800;cursor:pointer;margin-top:16px}.hint{font-size:13px;color:#777b75}.warn{font-size:13px;background:#fff8e8;color:#805d12;padding:12px;border-radius:11px}</style></head>
<body><main class="card"><h1>Conectar agente à sua empresa</h1><div class="badge">OAuth + PKCE • acesso empresarial isolado</div>
<p><strong>${this.escapeHtml(request.clientName || 'Cliente MCP')}</strong> está pedindo acesso ao PiraNegócios Business.</p>
<ul>${permissions || '<li>Nenhuma permissão solicitada</li>'}</ul>
<p class="warn">Use um código de conexão gerado dentro da sua conta empresarial. O código é de uso único e expira rapidamente. O agente nunca escolhe outra empresa por ID.</p>
<form method="post" action="${this.publicBaseUrl()}/api/company/oauth/authorize">
${hidden('response_type', request.responseType)}${hidden('client_id', request.clientId)}${hidden('redirect_uri', request.redirectUri)}${hidden('scope', requestedScopes.join(' '))}${hidden('state', request.state)}${hidden('code_challenge', request.codeChallenge)}${hidden('code_challenge_method', 'S256')}${hidden('resource', request.resource)}
<label for="connection_code">Código de conexão da empresa</label><input id="connection_code" name="connection_code" type="password" autocomplete="off" placeholder="pn_company_connect_..." required>
<p class="hint">Depois da autorização, o cliente passa a usar access token e refresh token OAuth próprios.</p><button type="submit">Autorizar conexão</button></form></main></body></html>`;
  }

  async approveAuthorization(body: Record<string, unknown>) {
    const request = await this.validateAuthorizationRequest(body);
    const connectionCode = String(body.connection_code || '').trim();
    if (!connectionCode.startsWith('pn_company_connect_')) throw new UnauthorizedException('Código de conexão inválido.');
    const rows = await this.dataSource.query(
      `SELECT * FROM company_mcp_connection_codes WHERE "codeHash"=$1 LIMIT 1`,
      [this.hash(connectionCode)],
    );
    const connection = rows[0];
    if (!connection || connection.usedAt || new Date(connection.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException('Código de conexão inválido, usado ou expirado.');
    }

    const access = await this.resolveCompanyAccess(String(connection.authorizedByUserId), String(connection.companyId));
    const requested = this.requestedOAuthScopes(request.scope).filter((scope) => scope !== 'offline_access');
    const codeScopes = this.jsonArray(connection.scopes);
    const live = new Set(this.liveScopes(access, codeScopes));
    const scopes = requested.filter((scope) => codeScopes.includes(scope) && live.has(scope));
    if (!scopes.length) throw new UnauthorizedException('A conexão não possui mais nenhuma permissão válida.');

    const rawCode = `pn_company_oauth_code_${randomBytes(32).toString('hex')}`;
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO company_mcp_oauth_codes(id,"codeHash","clientId","companyId","authorizedByUserId","redirectUri",resource,scopes,"codeChallenge","expiresAt")
         VALUES($1,$2,$3,$4::uuid,$5,$6,$7,$8::jsonb,$9,$10)`,
        [randomUUID(), this.hash(rawCode), request.clientId, access.companyId, access.userId, request.redirectUri, request.resource, JSON.stringify(scopes), request.codeChallenge, new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000)],
      );
      await manager.query(`UPDATE company_mcp_connection_codes SET "usedAt"=now() WHERE id=$1::uuid`, [connection.id]);
    });

    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set('code', rawCode);
    if (request.state) redirect.searchParams.set('state', request.state);
    redirect.searchParams.set('iss', this.issuer());
    return redirect.toString();
  }

  async exchangeToken(body: Record<string, unknown>) {
    const grantType = String(body.grant_type || '');
    if (grantType === 'authorization_code') return this.exchangeAuthorizationCode(body);
    if (grantType === 'refresh_token') return this.exchangeRefreshToken(body);
    throw new BadRequestException('grant_type não suportado.');
  }

  async verifyAccessToken(rawToken: string) {
    if (!rawToken.startsWith('pn_company_oauth_at_')) throw new UnauthorizedException('Access token OAuth inválido.');
    const rows = await this.dataSource.query(
      `SELECT * FROM company_mcp_oauth_tokens WHERE "accessTokenHash"=$1 LIMIT 1`,
      [this.hash(rawToken)],
    );
    const token = rows[0];
    if (!token || token.revokedAt || new Date(token.accessExpiresAt).getTime() <= Date.now() || token.resource !== this.mcpResource()) {
      throw new UnauthorizedException('Access token OAuth inválido ou expirado.');
    }
    const access = await this.resolveCompanyAccess(String(token.authorizedByUserId), String(token.companyId));
    const scopes = this.liveScopes(access, this.jsonArray(token.scopes));
    if (!scopes.length) throw new UnauthorizedException('A conexão não possui mais permissões empresariais válidas.');
    return {
      tokenId: String(token.id),
      clientId: String(token.clientId),
      company: { id: access.companyId, name: access.companyName },
      authorizedByUserId: access.userId,
      permissions: access.permissions,
      scopes,
    };
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
    await this.requireClient(clientId, redirectUri);
    const rows = await this.dataSource.query(
      `SELECT * FROM company_mcp_oauth_codes WHERE "codeHash"=$1 AND "clientId"=$2 LIMIT 1`,
      [this.hash(rawCode), clientId],
    );
    const code = rows[0];
    if (!code || code.usedAt || new Date(code.expiresAt).getTime() <= Date.now()) throw new BadRequestException('Código OAuth inválido ou expirado.');
    if (String(code.redirectUri) !== redirectUri || String(code.resource) !== resource || resource !== this.mcpResource()) {
      throw new BadRequestException('Código OAuth não pertence a este redirect_uri/resource.');
    }
    if (this.pkceChallenge(verifier) !== String(code.codeChallenge)) throw new BadRequestException('Falha na validação PKCE.');
    const access = await this.resolveCompanyAccess(String(code.authorizedByUserId), String(code.companyId));
    const scopes = this.liveScopes(access, this.jsonArray(code.scopes));
    if (!scopes.length) throw new UnauthorizedException('As permissões empresariais desta conexão foram revogadas.');
    await this.dataSource.query(`UPDATE company_mcp_oauth_codes SET "usedAt"=now() WHERE id=$1::uuid`, [code.id]);
    return this.issueTokens(clientId, access, resource, scopes);
  }

  private async exchangeRefreshToken(body: Record<string, unknown>) {
    const rawRefresh = String(body.refresh_token || '').trim();
    const clientId = String(body.client_id || '').trim();
    const resource = String(body.resource || '').trim();
    if (!rawRefresh || !clientId) throw new BadRequestException('refresh_token e client_id são obrigatórios.');
    await this.requireClient(clientId);
    const rows = await this.dataSource.query(
      `SELECT * FROM company_mcp_oauth_tokens WHERE "refreshTokenHash"=$1 AND "clientId"=$2 LIMIT 1`,
      [this.hash(rawRefresh), clientId],
    );
    const current = rows[0];
    if (!current || current.revokedAt || new Date(current.refreshExpiresAt).getTime() <= Date.now()) {
      throw new BadRequestException('Refresh token inválido ou expirado.');
    }
    if (resource && resource !== current.resource) throw new BadRequestException('resource inválido para este refresh token.');
    const access = await this.resolveCompanyAccess(String(current.authorizedByUserId), String(current.companyId));
    const scopes = this.liveScopes(access, this.jsonArray(current.scopes));
    if (!scopes.length) throw new BadRequestException('A conexão não possui mais permissões válidas.');
    await this.dataSource.query(`UPDATE company_mcp_oauth_tokens SET "revokedAt"=now(),"updatedAt"=now() WHERE id=$1::uuid`, [current.id]);
    return this.issueTokens(clientId, access, String(current.resource), scopes);
  }

  private async issueTokens(clientId: string, access: CompanyAccess, resource: string, scopes: string[]) {
    const accessToken = `pn_company_oauth_at_${randomBytes(32).toString('hex')}`;
    const refreshToken = `pn_company_oauth_rt_${randomBytes(40).toString('hex')}`;
    await this.dataSource.query(
      `INSERT INTO company_mcp_oauth_tokens(id,"clientId","companyId","authorizedByUserId","accessTokenHash","refreshTokenHash",resource,scopes,"accessExpiresAt","refreshExpiresAt")
       VALUES($1,$2,$3::uuid,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
      [randomUUID(), clientId, access.companyId, access.userId, this.hash(accessToken), this.hash(refreshToken), resource, JSON.stringify(scopes), new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000), new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)],
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
    const method = String(input.code_challenge_method || '');
    const resource = String(input.resource || '').trim();
    if (responseType !== 'code') throw new BadRequestException('response_type deve ser code.');
    if (!clientId || !redirectUri || !resource) throw new BadRequestException('client_id, redirect_uri e resource são obrigatórios.');
    if (!codeChallenge || method !== 'S256') throw new BadRequestException('PKCE com code_challenge_method=S256 é obrigatório.');
    if (resource !== this.mcpResource()) throw new BadRequestException('resource não é o endpoint MCP empresarial canônico.');
    const client = await this.requireClient(clientId, redirectUri);
    return { responseType, clientId, clientName: client.clientName, redirectUri, state, scope, codeChallenge, resource };
  }

  private requestedOAuthScopes(scope: string) {
    const requested = String(scope || '').split(/\s+/).map((item) => item.trim()).filter(Boolean);
    const source = requested.length ? requested : [...DEFAULT_COMPANY_MCP_SCOPES, 'offline_access'];
    const supported = new Set([...COMPANY_MCP_SCOPES, 'offline_access']);
    const invalid = source.filter((item) => !supported.has(item));
    if (invalid.length) throw new BadRequestException(`Escopos OAuth inválidos: ${invalid.join(', ')}`);
    return Array.from(new Set(source));
  }

  private normalizeScopes(raw: unknown, fallback: string[]) {
    const source = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(/\s+/) : fallback;
    const supported = new Set(COMPANY_MCP_SCOPES);
    const normalized = Array.from(new Set(source.map((item) => item.trim()).filter((item) => supported.has(item))));
    return normalized.length ? normalized : fallback;
  }

  private liveScopes(access: CompanyAccess, scopes: string[]) {
    const hasAny = access.elevated || Object.values(access.permissions).some(Boolean);
    return Array.from(new Set(scopes.filter((scope) => {
      const capability = companyScopeCapability(scope);
      if (!capability) return false;
      if (scope === 'company:read' || scope === 'analytics:reports:run') return hasAny;
      if (!capability.permission) return hasAny;
      return access.elevated || access.permissions[capability.permission] === true;
    })));
  }

  private async resolveCompanyAccess(userId: string, expectedCompanyId?: string): Promise<CompanyAccess> {
    const userRows = await this.dataSource.query(
      `SELECT id,type,"companyId","isCompanyAdmin" FROM users WHERE id=$1 LIMIT 1`,
      [userId],
    );
    const user = userRows[0];
    if (!user) throw new UnauthorizedException('Usuário que autorizou a conexão não existe mais.');

    let company: any = null;
    if (expectedCompanyId) {
      company = (await this.dataSource.query(`SELECT id,name,"ownerId" FROM companies WHERE id=$1::uuid LIMIT 1`, [expectedCompanyId]))[0];
    } else if (user.companyId) {
      company = (await this.dataSource.query(`SELECT id,name,"ownerId" FROM companies WHERE id::text=$1 LIMIT 1`, [String(user.companyId)]))[0];
    }
    if (!company && !expectedCompanyId) {
      company = (await this.dataSource.query(`SELECT id,name,"ownerId" FROM companies WHERE "ownerId"=$1 LIMIT 1`, [userId]))[0];
    }
    if (!company && !expectedCompanyId) {
      company = (await this.dataSource.query(
        `SELECT c.id,c.name,c."ownerId" FROM company_memberships m JOIN companies c ON c.id=m."companyId"
         WHERE m."userId"=$1 AND m.status='ACTIVE'
         ORDER BY CASE m.role WHEN 'PRIMARY_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,m."updatedAt" DESC LIMIT 1`,
        [userId],
      ))[0];
    }
    if (!company) throw new UnauthorizedException('A empresa vinculada à conexão não está mais disponível.');

    const membership = (await this.dataSource.query(
      `SELECT role,status,permissions FROM company_memberships WHERE "companyId"=$1::uuid AND "userId"=$2 AND status='ACTIVE' LIMIT 1`,
      [company.id, userId],
    ))[0];
    const owner = String(company.ownerId || '') === String(userId);
    const elevated = user.type === 'ADMIN' || owner || user.isCompanyAdmin === true || membership?.role === 'PRIMARY_ADMIN' || membership?.role === 'ADMIN';
    const raw = membership?.permissions && typeof membership.permissions === 'object' ? membership.permissions : {};
    const permissions: CompanyPermissions = {
      companyProfile: elevated || raw.companyProfile === true,
      marketplace: elevated || raw.marketplace === true,
      recruitment: elevated || raw.recruitment === true,
      finance: elevated || raw.finance === true,
      team: elevated || raw.team === true,
    };
    if (!elevated && !Object.values(permissions).some(Boolean)) throw new UnauthorizedException('O usuário não possui mais autorização empresarial.');
    if (expectedCompanyId && String(company.id) !== String(expectedCompanyId)) throw new UnauthorizedException('O vínculo empresarial da conexão foi alterado.');
    return { companyId: String(company.id), companyName: String(company.name || 'Empresa'), userId, elevated, permissions };
  }

  private async requireClient(clientId: string, redirectUri?: string) {
    const rows = await this.dataSource.query(
      `SELECT "clientId","clientName","redirectUris" FROM company_mcp_oauth_clients WHERE "clientId"=$1 AND active=true LIMIT 1`,
      [clientId],
    );
    const client = rows[0];
    if (!client) throw new BadRequestException('OAuth client inválido.');
    if (redirectUri && !this.jsonArray(client.redirectUris).includes(redirectUri)) throw new BadRequestException('redirect_uri não cadastrada para o cliente.');
    return { clientId: String(client.clientId), clientName: client.clientName ? String(client.clientName) : null };
  }

  private isAllowedRedirectUri(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
    } catch {
      return false;
    }
  }

  private jsonArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') {
      try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
    }
    return [];
  }

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private pkceChallenge(value: string) { return createHash('sha256').update(value).digest('base64url'); }
  private escapeHtml(value: string) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
}
