import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { ExternalApiClient } from './entities/external-api-client.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  constructor(
    @InjectRepository(ExternalApiClient)
    private readonly clients: Repository<ExternalApiClient>,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = String(request.headers.authorization || '');
    const rawKey = String(
      request.headers['x-api-key'] ||
        (authorization.startsWith('Bearer ') ? authorization.slice(7) : ''),
    ).trim();
    if (!rawKey.startsWith('pn_v1_') || rawKey.length < 40)
      throw new UnauthorizedException('Chave de API ausente ou inválida.');
    const client = await this.clients.findOne({
      where: { keyPrefix: rawKey.slice(0, 20), active: true },
    });
    const supplied = Buffer.from(
      createHash('sha256').update(rawKey).digest('hex'),
    );
    const expected = Buffer.from(client?.keyHash || '0'.repeat(64));
    if (
      !client ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new UnauthorizedException('Chave de API inválida ou revogada.');
    const requiredScope = request.method === 'GET' ? 'jobs:read' : 'jobs:write';
    if (!client.scopes.includes(requiredScope))
      throw new ForbiddenException(
        `Esta chave não possui o escopo ${requiredScope}.`,
      );
    const now = Date.now();
    const window = this.windows.get(client.id);
    if (!window || now - window.start >= 60_000)
      this.windows.set(client.id, { start: now, count: 1 });
    else if (++window.count > 60)
      throw new HttpException(
        'Limite de 60 requisições por minuto excedido.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    client.lastUsedAt = new Date();
    void this.clients.save(client).catch(() => undefined);
    request.apiClient = client;
    return true;
  }
}
