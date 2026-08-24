import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { MobileUploadSession } from './entities/mobile-upload-session.entity';

@Injectable()
export class MobileUploadTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(MobileUploadSession)
    private readonly sessions: Repository<MobileUploadSession>,
  ) {}

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const id = String(request.params?.id || '');
    const token = String(request.headers?.['x-upload-token'] || '').trim();
    if (!id || !token) throw new ForbiddenException('Token de upload inválido.');

    const tokenHash = this.hash(token);
    request.mobileUploadSession = await this.sessions.manager.transaction(async (manager) => {
      const session = await manager.findOne(MobileUploadSession, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) {
        throw new ForbiddenException('Sessão não autorizada para upload ou token já utilizado.');
      }

      const expiryRows = await manager.query(
        'SELECT ("expiresAt" <= now()) AS expired FROM mobile_upload_sessions WHERE id = $1 LIMIT 1',
        [id],
      );
      const expired = expiryRows?.[0]?.expired === true || expiryRows?.[0]?.expired === 'true';
      if (expired) {
        session.status = 'EXPIRED';
        session.uploadTokenHash = null;
        session.qrTokenHash = null;
        await manager.save(session);
        throw new BadRequestException('Esta sessão expirou. Gere um novo QR Code no computador.');
      }

      if (
        session.status !== 'PAIRED' ||
        !session.uploadTokenHash ||
        !this.safeEqual(tokenHash, session.uploadTokenHash)
      ) {
        throw new ForbiddenException('Sessão não autorizada para upload ou token já utilizado.');
      }

      // Consome a autorização só depois de obter a entidade TypeORM real.
      // Isso evita depender do formato bruto de UPDATE ... RETURNING do driver.
      session.uploadTokenHash = null;
      session.qrTokenHash = null;
      await manager.save(session);
      return session;
    });

    return true;
  }
}
