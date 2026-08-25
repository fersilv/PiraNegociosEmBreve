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
    const resourceMetadata = this.oauth.resourceMetadataUrl(instanceId);
    response.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${resourceMetadata}"`,
    );

    const authorization = String(request.headers.authorization || '');
    const rawToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!rawToken) throw new UnauthorizedException('OAuth access token não fornecido.');

    const auth = await this.oauth.verifyAccessToken(instanceId, rawToken);
    request.whatsappOAuth = auth;
    return true;
  }
}
