import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { Repository } from 'typeorm';
import { ChatGateway } from '../chat/chat.gateway';
import { MobileUploadPurpose, MobileUploadSession } from './entities/mobile-upload-session.entity';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const PAIRING_ATTEMPT_LIMIT = 5;

type PairOutcome =
  | { ok: true; uploadToken: string; purpose: MobileUploadPurpose; accept: string; maxSizeBytes: number; expiresAt: Date }
  | { ok: false; reason: 'EXPIRED' | 'PAIRED' | 'USED' | 'CANCELED' | 'TOO_MANY' | 'INVALID' };

const PURPOSE_RULES: Record<MobileUploadPurpose, { accept: string; extensions: Set<string>; mimePrefixes: string[]; mimeTypes: Set<string> }> = {
  avatar: {
    accept: 'image/jpeg,image/png,image/webp',
    extensions: new Set(['.jpg', '.jpeg', '.png', '.webp']),
    mimePrefixes: ['image/'],
    mimeTypes: new Set(),
  },
  resume: {
    accept: '.pdf,.doc,.docx,.txt,.rtf,image/jpeg,image/png,image/webp',
    extensions: new Set(['.pdf', '.doc', '.docx', '.txt', '.rtf', '.jpg', '.jpeg', '.png', '.webp']),
    mimePrefixes: ['image/'],
    mimeTypes: new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/rtf',
      'application/rtf',
    ]),
  },
  document: {
    accept: '.pdf,.doc,.docx,image/jpeg,image/png,image/webp',
    extensions: new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp']),
    mimePrefixes: ['image/'],
    mimeTypes: new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
  },
};

@Injectable()
export class MobileUploadSessionsService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(MobileUploadSession)
    private readonly sessions: Repository<MobileUploadSession>,
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    this.cleanupTimer = setInterval(() => void this.cleanupExpired(), 60_000);
    this.cleanupTimer.unref?.();
    void this.cleanupExpired();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async deleteFile(path?: string | null) {
    if (!path) return;
    await unlink(path).catch(() => undefined);
  }

  private isPurpose(value: unknown): value is MobileUploadPurpose {
    return value === 'avatar' || value === 'resume' || value === 'document';
  }

  private purposeRules(value: unknown) {
    if (!this.isPurpose(value)) {
      throw new BadRequestException('Esta sessão de transferência está inválida. Gere um novo QR Code e tente novamente.');
    }
    return PURPOSE_RULES[value];
  }

  private async cleanupExpired() {
    const expired = await this.sessions.createQueryBuilder('session')
      .where('session."expiresAt" <= now()')
      .andWhere('session.status NOT IN (:...finalStatuses)', { finalStatuses: ['CONSUMED', 'CANCELED', 'EXPIRED'] })
      .getMany()
      .catch(() => [] as MobileUploadSession[]);

    for (const session of expired) {
      await this.deleteFile(session.filePath);
      session.filePath = null;
      session.uploadTokenHash = null;
      session.qrTokenHash = null;
      session.status = 'EXPIRED';
      await this.sessions.save(session).catch(() => undefined);
    }

    await this.sessions.createQueryBuilder()
      .delete()
      .from(MobileUploadSession)
      .where('"expiresAt" < now() - interval \'24 hours\'')
      .andWhere('status IN (:...finalStatuses)', { finalStatuses: ['CONSUMED', 'CANCELED', 'EXPIRED'] })
      .execute()
      .catch(() => undefined);
  }

  private async expireIfNeeded(session: MobileUploadSession) {
    const rows = await this.sessions.manager.query(
      'SELECT ("expiresAt" <= now()) AS expired FROM mobile_upload_sessions WHERE id = $1 LIMIT 1',
      [session.id],
    );
    const expired = rows?.[0]?.expired === true || rows?.[0]?.expired === 'true';
    if (!expired) return session;
    if (!['CONSUMED', 'CANCELED', 'EXPIRED'].includes(session.status)) {
      session.status = 'EXPIRED';
      session.uploadTokenHash = null;
      session.qrTokenHash = null;
      await this.deleteFile(session.filePath);
      session.filePath = null;
      await this.sessions.save(session);
    }
    return session;
  }

  private normalizePurpose(value: unknown): MobileUploadPurpose {
    return this.isPurpose(value) ? value : 'document';
  }

  private completePairing(session: MobileUploadSession) {
    const uploadToken = randomBytes(32).toString('base64url');
    session.uploadTokenHash = this.hash(uploadToken);
    session.qrTokenHash = null;
    session.status = 'PAIRED';
    session.pairedAt = new Date();
    session.pairingAttempts = 0;
    return uploadToken;
  }

  private throwPairError(reason: Exclude<PairOutcome, { ok: true }>['reason'], invalidMessage: string): never {
    switch (reason) {
      case 'EXPIRED':
        throw new BadRequestException('Esta sessão expirou. Gere um novo QR Code no computador.');
      case 'PAIRED':
        throw new BadRequestException('Este telefone já foi pareado. Gere uma nova sessão para trocar de dispositivo.');
      case 'USED':
        throw new BadRequestException('Esta sessão já foi utilizada.');
      case 'CANCELED':
        throw new BadRequestException('Esta sessão foi cancelada. Gere um novo QR Code no computador.');
      case 'TOO_MANY':
        throw new ForbiddenException('Muitas tentativas incorretas. Gere uma nova sessão.');
      case 'INVALID':
      default:
        throw new ForbiddenException(invalidMessage);
    }
  }

  async create(userId: string, body: { purpose?: unknown; maxSizeKB?: unknown }) {
    const purpose = this.normalizePurpose(body?.purpose);
    const requestedBytes = Math.max(256 * 1024, Number(body?.maxSizeKB || 10240) * 1024);
    const maxSizeBytes = Math.min(MAX_FILE_BYTES, Math.round(requestedBytes));
    const pairingCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const pairingSalt = randomBytes(24).toString('hex');
    const qrToken = randomBytes(32).toString('base64url');
    const id = randomUUID();
    const clockRows = await this.sessions.manager.query(
      'SELECT now() + interval \'5 minutes\' AS "expiresAt"',
    );
    const expiresAt = new Date(clockRows?.[0]?.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Não foi possível iniciar a sessão de transferência. Tente novamente.');
    }
    const session = this.sessions.create({
      id,
      userId,
      purpose,
      status: 'WAITING',
      pairingSalt,
      pairingHash: this.hash(`${pairingSalt}:${pairingCode}`),
      pairingAttempts: 0,
      qrTokenHash: this.hash(qrToken),
      uploadTokenHash: null,
      maxSizeBytes,
      accept: PURPOSE_RULES[purpose].accept,
      filePath: null,
      fileName: null,
      mimeType: null,
      fileSize: null,
      expiresAt,
      pairedAt: null,
      uploadedAt: null,
      consumedAt: null,
    });
    await this.sessions.save(session);
    return {
      id,
      pairingCode,
      qrToken,
      purpose,
      accept: session.accept,
      maxSizeBytes,
      expiresAt: session.expiresAt,
    };
  }

  async pair(id: string, code: unknown) {
    const outcome: PairOutcome = await this.sessions.manager.transaction(async (manager): Promise<PairOutcome> => {
      const session = await manager.findOne(MobileUploadSession, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new NotFoundException('Sessão de transferência não encontrada.');

      const expiryRows = await manager.query(
        'SELECT ("expiresAt" <= now()) AS expired FROM mobile_upload_sessions WHERE id = $1 LIMIT 1',
        [id],
      );
      const expired = expiryRows?.[0]?.expired === true || expiryRows?.[0]?.expired === 'true';
      if (expired) {
        await this.deleteFile(session.filePath);
        session.filePath = null;
        session.uploadTokenHash = null;
        session.qrTokenHash = null;
        session.status = 'EXPIRED';
        await manager.save(session);
        return { ok: false, reason: 'EXPIRED' };
      }
      if (session.status === 'PAIRED') return { ok: false, reason: 'PAIRED' };
      if (session.status === 'UPLOADED' || session.status === 'CONSUMED') return { ok: false, reason: 'USED' };
      if (session.status === 'CANCELED') return { ok: false, reason: 'CANCELED' };
      if (session.pairingAttempts >= PAIRING_ATTEMPT_LIMIT) return { ok: false, reason: 'TOO_MANY' };

      const normalizedCode = String(code || '').replace(/\D/g, '').slice(0, 6);
      const candidateHash = this.hash(`${session.pairingSalt}:${normalizedCode}`);
      if (!this.safeEqual(candidateHash, session.pairingHash)) {
        session.pairingAttempts += 1;
        await manager.save(session);
        return {
          ok: false,
          reason: session.pairingAttempts >= PAIRING_ATTEMPT_LIMIT ? 'TOO_MANY' : 'INVALID',
        };
      }

      this.purposeRules(session.purpose);
      const uploadToken = this.completePairing(session);
      await manager.save(session);
      return {
        ok: true,
        uploadToken,
        purpose: session.purpose,
        accept: session.accept,
        maxSizeBytes: session.maxSizeBytes,
        expiresAt: session.expiresAt,
      };
    });

    if (outcome.ok) return outcome;
    return this.throwPairError(outcome.reason, 'Código de pareamento inválido.');
  }

  async pairWithQrToken(id: string, tokenInput: unknown) {
    const token = String(tokenInput || '').trim();
    if (token.length < 32) throw new ForbiddenException('QR Code inválido ou incompleto.');
    const tokenHash = this.hash(token);

    const outcome: PairOutcome = await this.sessions.manager.transaction(async (manager): Promise<PairOutcome> => {
      const session = await manager.findOne(MobileUploadSession, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new NotFoundException('Sessão de transferência não encontrada.');

      const expiryRows = await manager.query(
        'SELECT ("expiresAt" <= now()) AS expired FROM mobile_upload_sessions WHERE id = $1 LIMIT 1',
        [id],
      );
      const expired = expiryRows?.[0]?.expired === true || expiryRows?.[0]?.expired === 'true';
      if (expired) {
        await this.deleteFile(session.filePath);
        session.filePath = null;
        session.uploadTokenHash = null;
        session.qrTokenHash = null;
        session.status = 'EXPIRED';
        await manager.save(session);
        return { ok: false, reason: 'EXPIRED' };
      }

      if (session.status === 'UPLOADED' || session.status === 'CONSUMED') return { ok: false, reason: 'USED' };
      if (session.status === 'CANCELED') return { ok: false, reason: 'CANCELED' };

      // O mesmo segredo do QR pode reabrir a MESMA sessão enquanto ela estiver
      // pareada. Isso torna o fluxo resistente a leitores de QR que abrem uma
      // prévia da página antes de entregá-la ao navegador. Um segredo diferente
      // continua sem acesso.
      if (!session.qrTokenHash || !this.safeEqual(tokenHash, session.qrTokenHash)) {
        return { ok: false, reason: 'INVALID' };
      }

      this.purposeRules(session.purpose);

      if (session.status === 'PAIRED') {
        // Depois que o upload começa, authorizeUpload consome os dois hashes.
        // Portanto só reemitimos a autorização se ela ainda não foi consumida.
        if (!session.uploadTokenHash || !this.safeEqual(tokenHash, session.uploadTokenHash)) {
          return { ok: false, reason: 'USED' };
        }
        return {
          ok: true,
          uploadToken: token,
          purpose: session.purpose,
          accept: session.accept,
          maxSizeBytes: session.maxSizeBytes,
          expiresAt: session.expiresAt,
        };
      }

      if (session.status !== 'WAITING') return { ok: false, reason: 'USED' };

      // No fluxo por QR, o segredo aleatório de 256 bits é também a credencial
      // temporária de upload. Guardamos somente o SHA-256 dele no banco.
      session.uploadTokenHash = tokenHash;
      session.status = 'PAIRED';
      session.pairedAt = new Date();
      session.pairingAttempts = 0;
      await manager.save(session);

      return {
        ok: true,
        uploadToken: token,
        purpose: session.purpose,
        accept: session.accept,
        maxSizeBytes: session.maxSizeBytes,
        expiresAt: session.expiresAt,
      };
    });

    if (outcome.ok) return outcome;
    return this.throwPairError(outcome.reason, 'QR Code inválido ou já utilizado.');
  }

  async authorizeUpload(id: string, token: string) {
    if (!token) throw new ForbiddenException('Token de upload inválido.');
    const tokenHash = this.hash(token);
    const rows = await this.sessions.manager.query(
      `UPDATE mobile_upload_sessions
       SET "uploadTokenHash" = NULL,
           "qrTokenHash" = NULL
       WHERE id = $1
         AND status = 'PAIRED'
         AND "uploadTokenHash" = $2
         AND "expiresAt" > now()
       RETURNING *`,
      [id, tokenHash],
    );
    const row = rows?.[0];
    if (!row) throw new ForbiddenException('Sessão não autorizada para upload ou token já utilizado.');
    this.purposeRules(row.purpose);
    return this.sessions.create({
      ...row,
      expiresAt: new Date(row.expiresAt),
      pairedAt: row.pairedAt ? new Date(row.pairedAt) : null,
      uploadedAt: row.uploadedAt ? new Date(row.uploadedAt) : null,
      consumedAt: row.consumedAt ? new Date(row.consumedAt) : null,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    });
  }

  private validateFile(session: MobileUploadSession, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo foi enviado.');
    if (file.size <= 0 || file.size > session.maxSizeBytes) throw new BadRequestException('O arquivo excede o limite permitido para esta transferência.');
    const rules = this.purposeRules(session?.purpose);
    const extension = extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const mimeAllowed = rules.mimeTypes.has(mime) || rules.mimePrefixes.some((prefix) => mime.startsWith(prefix));
    if (!rules.extensions.has(extension) || !mimeAllowed) throw new BadRequestException('Tipo de arquivo não permitido para esta transferência.');
    return extension;
  }

  async receiveAuthorized(session: MobileUploadSession, file: Express.Multer.File) {
    const extension = this.validateFile(session, file);
    const directory = join(process.cwd(), '.private', 'mobile-transfer');
    await mkdir(directory, { recursive: true });
    const filePath = join(directory, `${session.id}-${randomBytes(8).toString('hex')}${extension}`);
    await writeFile(filePath, file.buffer);

    session.filePath = filePath;
    session.fileName = String(file.originalname || `arquivo${extension}`).slice(0, 220);
    session.mimeType = file.mimetype || 'application/octet-stream';
    session.fileSize = file.size;
    session.uploadedAt = new Date();
    session.status = 'UPLOADED';
    session.uploadTokenHash = null;
    session.qrTokenHash = null;
    await this.sessions.save(session);

    this.chatGateway.publishMobileUploadReady(session.userId, {
      sessionId: session.id,
      purpose: session.purpose,
      fileName: session.fileName,
      fileSize: session.fileSize,
    });

    return { ok: true, status: session.status };
  }

  async statusForOwner(id: string, userId: string) {
    const session = await this.sessions.findOne({ where: { id, userId } });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    await this.expireIfNeeded(session);
    return {
      id: session.id,
      purpose: session.purpose,
      status: session.status,
      fileName: session.fileName,
      fileSize: session.fileSize,
      expiresAt: session.expiresAt,
    };
  }

  async consume(id: string, userId: string) {
    const session = await this.sessions.findOne({ where: { id, userId } });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    await this.expireIfNeeded(session);
    if (session.status !== 'UPLOADED' || !session.filePath || !session.fileName || !session.mimeType) {
      throw new BadRequestException('Nenhum arquivo novo está pronto para ser recebido.');
    }
    const buffer = await readFile(session.filePath).catch(() => null);
    if (!buffer) throw new BadRequestException('O arquivo temporário desta sessão não está mais disponível.');
    const dataUrl = `data:${session.mimeType};base64,${buffer.toString('base64')}`;
    const result = { dataUrl, fileName: session.fileName, mimeType: session.mimeType, size: session.fileSize || buffer.length };
    await this.deleteFile(session.filePath);
    session.filePath = null;
    session.uploadTokenHash = null;
    session.qrTokenHash = null;
    session.status = 'CONSUMED';
    session.consumedAt = new Date();
    await this.sessions.save(session);
    return result;
  }

  async cancel(id: string, userId: string) {
    const session = await this.sessions.findOne({ where: { id, userId } });
    if (!session) return { ok: true };
    await this.deleteFile(session.filePath);
    session.filePath = null;
    session.uploadTokenHash = null;
    session.qrTokenHash = null;
    session.status = 'CANCELED';
    await this.sessions.save(session);
    return { ok: true };
  }
}
