import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CompanyMcpOAuthService } from './company-mcp-oauth.service';

@Injectable()
export class CompanyMcpOAuthGuard implements CanActivate {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly oauth: CompanyMcpOAuthService) {}

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
      const rateKey = `${auth.company.id}:${auth.clientId}`;
      const now = Date.now();
      const window = this.windows.get(rateKey);
      if (!window || now - window.start >= 60_000) {
        this.windows.set(rateKey, { start: now, count: 1 });
      } else if (++window.count > 120) {
        throw new HttpException('Limite de 120 requisições por minuto excedido.', HttpStatus.TOO_MANY_REQUESTS);
      }
      request.companyMcpOAuth = auth;
      return true;
    } catch (error) {
      response.setHeader('WWW-Authenticate', challenge);
      throw error;
    }
  }
}
