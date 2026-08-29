import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';
export declare const WHATSAPP_SCOPE_METADATA = "whatsappRequiredScope";
export declare const RequireWhatsAppScope: (scope: string) => import("@nestjs/common").CustomDecorator<string>;
export declare class WhatsAppApiKeyGuard implements CanActivate {
    private readonly reflector;
    private readonly keys;
    private readonly instances;
    private readonly windows;
    constructor(reflector: Reflector, keys: Repository<WhatsAppApiKey>, instances: Repository<WhatsAppInstance>);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
