import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';

@Injectable()
export class WhatsAppOAuthGuard implements CanActivate {
  constructor(private readonly oauth: WhatsAppOAuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const instanceId = String(request.params?.instanceId || '').trim();
    const challenge = `Bearer resource_metadata="${this.oauth.resourceMetadataUrl(instanceId)}"`;

    const authorization = String(request.headers.authorization || '');
    const rawToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!rawToken) {
      response.setHeader('WWW-Authenticate', challenge);
      throw new UnauthorizedException('OAuth access token não fornecido.');
    }

    try {
      const auth = await this.oauth.verifyAccessToken(instanceId, rawToken);
      request.whatsappOAuth = auth;
      return true;
    } catch (error) {
      response.setHeader('WWW-Authenticate', challenge);
      throw error;
    }
  }
}
