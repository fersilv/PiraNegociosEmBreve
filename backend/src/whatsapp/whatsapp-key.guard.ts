import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { WhatsAppApiKey } from './entities/whatsapp-api-key.entity';
import { WhatsAppInstance } from './entities/whatsapp-instance.entity';

export const WHATSAPP_SCOPE_METADATA = 'whatsappRequiredScope';
export const RequireWhatsAppScope = (scope: string) => SetMetadata(WHATSAPP_SCOPE_METADATA, scope);

@Injectable()
export class WhatsAppApiKeyGuard implements CanActivate {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(WhatsAppApiKey) private readonly keys: Repository<WhatsAppApiKey>,
    @InjectRepository(WhatsAppInstance) private readonly instances: Repository<WhatsAppInstance>,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = String(request.headers.authorization || '');
    const rawKey = String(
      request.headers['x-api-key'] ||
        (authorization.startsWith('Bearer ') ? authorization.slice(7) : ''),
    ).trim();

    if (!rawKey.startsWith('pn_wa_') || rawKey.length < 45) {
      throw new UnauthorizedException('Chave do WhatsApp ausente ou inválida.');
    }

    const key = await this.keys.findOne({
      where: { keyPrefix: rawKey.slice(0, 24), active: true },
    });
    const supplied = Buffer.from(createHash('sha256').update(rawKey).digest('hex'));
    const expected = Buffer.from(key?.keyHash || '0'.repeat(64));
    if (!key || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Chave do WhatsApp inválida ou revogada.');
    }
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Esta chave do WhatsApp expirou.');
    }

    const instanceId = String(request.params?.instanceId || '').trim();
    if (!instanceId || key.instanceId !== instanceId) {
      throw new ForbiddenException('Esta chave não pertence ao número solicitado.');
    }
    const instance = await this.instances.findOne({ where: { id: instanceId, active: true } });
    if (!instance) throw new ForbiddenException('Número desativado ou inexistente.');

    const requiredScope = this.reflector.getAllAndOverride<string>(WHATSAPP_SCOPE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredScope && !key.scopes.includes(requiredScope)) {
      throw new ForbiddenException(`Esta chave não possui o escopo ${requiredScope}.`);
    }

    const now = Date.now();
    const window = this.windows.get(key.id);
    if (!window || now - window.start >= 60_000) {
      this.windows.set(key.id, { start: now, count: 1 });
    } else if (++window.count > 120) {
      throw new HttpException('Limite de 120 requisições por minuto excedido.', HttpStatus.TOO_MANY_REQUESTS);
    }

    key.lastUsedAt = new Date();
    void this.keys.save(key).catch(() => undefined);
    request.whatsappApiKey = key;
    request.whatsappInstance = instance;
    return true;
  }
}
