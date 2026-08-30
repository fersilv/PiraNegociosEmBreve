import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompanyMcpLiveAccessService } from './company-mcp-live-access.service';
import { CompanyMcpOAuthService } from './company-mcp-oauth.service';

@Injectable()
export class CompanyMcpOAuthGuard implements CanActivate {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly oauth: CompanyMcpOAuthService,
    private readonly liveAccess: CompanyMcpLiveAccessService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const resourceMetadata = `${this.oauth.publicBaseUrl()}/.well-known/oauth-protected-resource/api/company/mcp`;
    const challenge = [
      'Bearer error="invalid_token"',
      'error_description="Authentication required"',
      `resource_metadata="${resourceMetadata}"`,
    ].join(', ');

    const authorization = String(request.headers.authorization || '');
    const rawToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!rawToken) {
      response.setHeader('WWW-Authenticate', challenge);
      throw new UnauthorizedException('OAuth access token empresarial não fornecido.');
    }

    try {
      const auth = await this.oauth.verifyAccessToken(rawToken);
      const live = await this.liveAccess.validate(
        String(auth.company.id),
        String(auth.authorizedByUserId),
        auth.scopes || [],
      );
      const securedAuth = {
        ...auth,
        company: live.company,
        permissions: live.permissions,
        scopes: live.scopes,
      };
      const rateKey = `${securedAuth.company.id}:${securedAuth.clientId}`;
      const now = Date.now();
      const window = this.windows.get(rateKey);
      if (!window || now - window.start >= 60_000) {
        this.windows.set(rateKey, { start: now, count: 1 });
      } else if (++window.count > 120) {
        throw new HttpException('Limite de 120 requisições por minuto excedido.', HttpStatus.TOO_MANY_REQUESTS);
      }
      request.companyMcpOAuth = securedAuth;
      return true;
    } catch (error) {
      response.setHeader('WWW-Authenticate', challenge);
      throw error;
    }
  }
}
