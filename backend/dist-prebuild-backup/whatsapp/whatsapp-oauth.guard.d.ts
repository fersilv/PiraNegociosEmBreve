import { CanActivate, ExecutionContext } from '@nestjs/common';
import { WhatsAppOAuthService } from './whatsapp-oauth.service';
export declare class WhatsAppOAuthGuard implements CanActivate {
    private readonly oauth;
    constructor(oauth: WhatsAppOAuthService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
