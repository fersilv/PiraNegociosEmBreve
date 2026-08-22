import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity';
import { slugify } from '../seo/seo.utils';
import { ExternalApiClient } from './entities/external-api-client.entity';
import { ExternalApiRequest } from './entities/external-api-request.entity';

export type ExternalJobInput = {
  title?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  city?: unknown;
  state?: unknown;
  description?: unknown;
  requirements?: unknown;
  type?: unknown;
  workModel?: unknown;
  salary?: unknown;
  pcdMode?: unknown;
  applicationEmail?: unknown;
  applicationWhatsApp?: unknown;
  externalApplicationInstructions?: unknown;
  deadlineDate?: unknown;
  allowSimilarDuplicate?: unknown;
  isTalentPool?: unknown;
  isFlagged?: unknown;
  flagObservation?: unknown;
  companyName?: unknown;
  sourceExternalId?: unknown;
  sourcePublishedAt?: unknown;
  lastVerifiedAt?: unknown;
  lastSeenAt?: unknown;
  flagReason?: unknown;
  flaggedAt?: unknown;
  flaggedBy?: unknown;
};

type SanitizedExternalJob = {
  title: string;
  description: string;
  city: string;
  state: string;
  location: string;
  sourceName: string;
  sourceUrl: string | null;
  requirements: string | null;
  type: string;
  workModel: string;
  salary: string | null;
  pcdMode: string;
  applicationEmail: string | null;
  applicationWhatsApp: string | null;
  externalApplicationInstructions: string | null;
  deadlineDate: string | null;
  isTalentPool: boolean;
  isFlagged: boolean;
  flagObservation: string | null;
  companyName: string;
  sourceExternalId: string | null;
  sourcePublishedAt: Date | null;
  lastVerifiedAt: Date | null;
  lastSeenAt: Date | null;
  flagReason: string | null;
  flaggedAt: Date | null;
  flaggedBy: string | null;
};

export type JobCatalogQuery = {
  q?: string;
  limit?: string;
  cursor?: string;
  active?: string;
  external?: string;
  city?: string;
  state?: string;
  type?: string;
  workModel?: string;
  companyId?: string;
  pcdMode?: string;
};

type CatalogFilters = {
  q: string;
  active: boolean | null;
  external: boolean | null;
  city: string;
  state: string;
  type: string;
  workModel: string;
  companyId: string;
  pcdMode: string;
};

@Injectable()
export class ExternalJobsService {
  private readonly validStates = new Set([
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
  ]);

  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(ExternalApiRequest)
    private readonly requests: Repository<ExternalApiRequest>,
  ) {}

  async check(input: ExternalJobInput, client: ExternalApiClient) {
    const match = await this.findDuplicate(input, client);
    await this.log(client.id, 'CHECK', match.job?.id || null, match.duplicate ? 'DUPLICATE' : 'AVAILABLE', { confidence: match.confidence });
    return match;
  }

  async findDuplicate(input: ExternalJobInput, client: ExternalApiClient) {
    const data = this.sanitize(input, client);
    const fingerprint = createHash('sha256')
      .update(`${this.normalize(data.title)}|${this.normalize(data.sourceName)}|${this.normalize(data.city)}|${data.state}`)
      .digest('hex');

    const exactWhere: FindOptionsWhere<Job>[] = [];
    if (data.sourceExternalId) exactWhere.push({ sourceExternalId: data.sourceExternalId, ingestionSourceId: client.id });
    if (data.sourceUrl) exactWhere.push({ sourceUrl: data.sourceUrl });

    if (exactWhere.length > 0) {
      const exact = await this.jobs.findOne({ where: exactWhere });
      if (exact) {
        return {
          duplicate: true,
          matchType: 'EXACT' as const,
          confidence: 1,
          job: this.publicResult(exact),
          fingerprint,
          data,
          signals: {
            sameSourceExternalId: data.sourceExternalId && exact.sourceExternalId === data.sourceExternalId,
            sameSourceUrl: data.sourceUrl && exact.sourceUrl === data.sourceUrl,
          },
        };
      }
    }

    const recent = await this.jobs.find({ order: { createdAt: 'DESC' }, take: 500 });
    let best: { job: Job; score: number; signals: any } | null = null;
    for (const job of recent) {
      const titleScore = this.similarity(data.title, job.title);
      const companyScore = this.similarity(data.companyName, job.companyName || job.sourceName);
      const sameCity = this.normalize(data.city) === this.normalize(job.city || job.location);
      const sameState = data.state === (job.state || 'SP');
      const score = titleScore * 0.5 + companyScore * 0.35 + (sameCity && sameState ? 0.15 : 0);
      if (!best || score > best.score) {
        best = {
          job,
          score,
          signals: {
            sameTitle: titleScore > 0.8,
            sameCompany: companyScore > 0.8,
            sameCity,
            sameSourceExternalId: false,
            sameSourceUrl: false,
            titleSimilarity: Number(titleScore.toFixed(2)),
            companySimilarity: Number(companyScore.toFixed(2)),
          },
        };
      }
    }

    if (best && best.score >= 0.85) {
      return { duplicate: true, matchType: 'LIKELY' as const, confidence: Number(best.score.toFixed(2)), job: this.publicResult(best.job), fingerprint, data, signals: best.signals };
    }
    if (best && best.score >= 0.65) {
      return { duplicate: false, matchType: 'SIMILAR' as const, confidence: Number(best.score.toFixed(2)), closestJob: this.publicResult(best.job), fingerprint, data, signals: best.signals };
    }
    return { duplicate: false, matchType: null, confidence: best ? Number(best.score.toFixed(2)) : 0, closestJob: best ? this.publicResult(best.job) : null, fingerprint, data, signals: best ? best.signals : null };
  }

  async create(input: ExternalJobInput, client: ExternalApiClient) {
    const match = await this.findDuplicate(input, client);
    if (input.allowSimilarDuplicate !== undefined && typeof input.allowSimilarDuplicate !== 'boolean')
      throw new BadRequestException('allowSimilarDuplicate deve ser true ou false.');
    const overriddenSimilarMatch = match.duplicate && (match.matchType === 'SIMILAR' || match.matchType === 'LIKELY') && input.allowSimilarDuplicate === true;
    if (match.duplicate && !overriddenSimilarMatch) {
      await this.log(client.id, 'CREATE', (match as any).job?.id || null, 'DUPLICATE', { confidence: match.confidence });
      return match;
    }

    const data = match.data;
    const slug = await this.nextSlug(`${data.title}-${data.sourceName}`);
    try {
      const job = await this.jobs.save(this.jobs.create({
        ...data,
        ownerId: `api:${client.id}`,
        companyId: null,
        companyName: data.companyName,
        isExternalListing: true,
        externalFingerprint: match.fingerprint,
        ingestionSourceId: client.id,
        ingestionSourceName: client.name,
        moderationStatus: 'PENDING',
        acceptsPlatformApplications: false,
        active: false,
        slug,
      }));
      await this.log(client.id, 'CREATE', job.id, 'CREATED', null);
      return { duplicate: false, created: true, moderationStatus: job.moderationStatus, similarMatchOverridden: overriddenSimilarMatch, job: this.publicResult(job) };
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') {
        const concurrentMatch = await this.findDuplicate(input, client);
        await this.log(client.id, 'CREATE', concurrentMatch.job?.id || null, 'DUPLICATE', { confidence: concurrentMatch.confidence, concurrent: true });
        return concurrentMatch;
      }
      throw error;
    }
  }

  async update(id: string, input: ExternalJobInput, client: ExternalApiClient) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('O corpo da requisição deve ser um objeto JSON.');
    for (const field of ['status', 'active', 'moderationStatus']) {
      if (Object.prototype.hasOwnProperty.call(input, field)) throw new BadRequestException(`O campo ${field} não pode ser alterado pela API.`);
    }

    const job = await this.jobs.findOne({ where: { id } });
    if (!job || !job.isExternalListing || job.ingestionSourceId !== client.id) throw new NotFoundException('Vaga não encontrada ou não é um cadastro externo gerido por esta API.');

    const merged: ExternalJobInput = {
      title: input.title !== undefined ? input.title : job.title,
      description: input.description !== undefined ? input.description : job.description,
      requirements: input.requirements !== undefined ? input.requirements : job.requirements,
      sourceName: input.sourceName !== undefined ? input.sourceName : job.sourceName,
      sourceUrl: input.sourceUrl !== undefined ? input.sourceUrl : job.sourceUrl,
      city: input.city !== undefined ? input.city : job.city,
      state: input.state !== undefined ? input.state : job.state,
      type: input.type !== undefined ? input.type : job.type,
      workModel: input.workModel !== undefined ? input.workModel : job.workModel,
      salary: input.salary !== undefined ? input.salary : job.salary,
      pcdMode: input.pcdMode !== undefined ? input.pcdMode : job.pcdMode,
      applicationEmail: input.applicationEmail !== undefined ? input.applicationEmail : job.applicationEmail,
      applicationWhatsApp: input.applicationWhatsApp !== undefined ? input.applicationWhatsApp : job.applicationWhatsApp,
      externalApplicationInstructions: input.externalApplicationInstructions !== undefined ? input.externalApplicationInstructions : job.externalApplicationInstructions,
      deadlineDate: input.deadlineDate !== undefined ? input.deadlineDate : job.deadlineDate,
      isTalentPool: input.isTalentPool !== undefined ? input.isTalentPool : job.isTalentPool,
      isFlagged: input.isFlagged !== undefined ? input.isFlagged : job.isFlagged,
      flagObservation: input.flagObservation !== undefined ? input.flagObservation : job.flagObservation,
      companyName: input.companyName !== undefined ? input.companyName : job.companyName,
      sourceExternalId: input.sourceExternalId !== undefined ? input.sourceExternalId : job.sourceExternalId,
      sourcePublishedAt: input.sourcePublishedAt !== undefined ? input.sourcePublishedAt : job.sourcePublishedAt,
      lastVerifiedAt: input.lastVerifiedAt !== undefined ? input.lastVerifiedAt : job.lastVerifiedAt,
      lastSeenAt: input.lastSeenAt !== undefined ? input.lastSeenAt : job.lastSeenAt,
      flagReason: input.flagReason !== undefined ? input.flagReason : job.flagReason,
      flaggedAt: input.flaggedAt !== undefined ? input.flaggedAt : job.flaggedAt,
      flaggedBy: input.flaggedBy !== undefined ? input.flaggedBy : job.flaggedBy,
    };
    const data = this.sanitize(merged, client);
    const fingerprint = createHash('sha256').update(`${this.normalize(data.title)}|${this.normalize(data.sourceName)}|${this.normalize(data.city)}|${data.state}`).digest('hex');
    const duplicateWhere: FindOptionsWhere<Job>[] = [{ externalFingerprint: fingerprint }];
    if (data.sourceUrl) duplicateWhere.push({ sourceUrl: data.sourceUrl });
    const duplicate = await this.jobs.findOne({ where: duplicateWhere });
    if (duplicate && duplicate.id !== job.id) throw new ConflictException('A alteração deixaria esta vaga duplicada de outra já cadastrada.');

    Object.assign(job, data, { externalFingerprint: fingerprint });
    try {
      const updated = await this.jobs.save(job);
      await this.log(client.id, 'UPDATE', job.id, 'UPDATED', null);
      return { updated: true, job: this.publicResult(updated) };
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') throw new ConflictException('A alteração deixaria esta vaga duplicada de outra já cadastrada.');
      throw error;
    }
  }

  async verify(id: string, input: any, client: ExternalApiClient) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('O corpo da requisição deve ser um objeto JSON.');
    const job = await this.jobs.findOne({ where: { id } });
    if (!job || !job.isExternalListing) throw new NotFoundException('Vaga não encontrada ou não é um cadastro externo.');
    const validStatuses = ['AVAILABLE', 'NOT_FOUND', 'CLOSED', 'EXPIRED', 'UNCERTAIN'];
    if (!validStatuses.includes(input.status)) throw new BadRequestException(`status deve ser um dos seguintes: ${validStatuses.join(', ')}`);
    job.lastVerifiedAt = new Date();
    job.lastSeenAt = new Date();
    if (input.status === 'AVAILABLE') {
      if (job.isFlagged) { job.isFlagged = false; job.flagReason = null; job.flagObservation = null; }
      job.active = true;
    } else if (input.status === 'CLOSED' || input.status === 'EXPIRED') {
      job.active = false; job.isFlagged = true; job.flagReason = input.status; job.flagObservation = input.observation || `Vaga marcada como ${input.status} via verificação.`; job.flaggedAt = new Date(); job.flaggedBy = client.name;
    } else {
      job.isFlagged = true; job.flagReason = input.status; job.flagObservation = input.observation || `Vaga sinalizada como ${input.status} via verificação.`; job.flaggedAt = new Date(); job.flaggedBy = client.name;
    }
    const updated = await this.jobs.save(job);
    await this.log(client.id, 'VERIFY', job.id, input.status, null);
    return { verified: true, job: this.publicResult(updated) };
  }

  async list(query: JobCatalogQuery, client: ExternalApiClient) {
    const requestedLimit = Number(query.limit || 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 50;
    const filters = this.catalogFilters(query);
    const filterHash = createHash('sha256').update(JSON.stringify(filters)).digest('hex');
    const cursor = query.cursor ? this.decodeCursor(query.cursor, filterHash, client) : null;
    const builder = this.jobs.createQueryBuilder('job').orderBy('job.createdAt', 'DESC').addOrderBy('job.id', 'DESC').take(limit + 1);
    if (cursor) builder.andWhere('(job."createdAt" < :cursorCreatedAt OR (job."createdAt" = :cursorCreatedAt AND job.id < :cursorId))', { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id });
    if (filters.active !== null) builder.andWhere('job.active = :active', { active: filters.active });
    if (filters.external !== null) builder.andWhere('job."isExternalListing" = :external', { external: filters.external });
    if (filters.city) builder.andWhere('LOWER(job.city) = LOWER(:city)', { city: filters.city });
    if (filters.state) builder.andWhere('UPPER(job.state) = :state', { state: filters.state });
    if (filters.type) builder.andWhere('LOWER(job.type) = LOWER(:type)', { type: filters.type });
    if (filters.workModel) builder.andWhere('LOWER(job."workModel") = LOWER(:workModel)', { workModel: filters.workModel });
    if (filters.companyId) builder.andWhere('job."companyId" = :companyId', { companyId: filters.companyId });
    if (filters.pcdMode) builder.andWhere('job."pcdMode" = :pcdMode', { pcdMode: filters.pcdMode });

    const searchTokens = this.normalize(filters.q).split(' ').filter((token) => token.length > 1).slice(0, 12);
    const searchable = `translate(lower(concat_ws(' ', job.title, job."companyName", job."sourceName", job.description, job.requirements, job.location, job.city, job.state, job.type, job."workModel", job.salary, job."pcdMode")), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
    searchTokens.forEach((token, index) => builder.andWhere(`${searchable} LIKE :searchToken${index}`, { [`searchToken${index}`]: `%${token}%` }));
    const rows = await builder.getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const nextCursor = hasMore && last ? this.encodeCursor(last.createdAt, last.id, filterHash, client) : null;
    await this.log(client.id, 'LIST', null, 'OK', { filters, count: page.length, hasMore, cursorUsed: Boolean(query.cursor) });
    return { data: page.map((job) => this.catalogResult(job)), pagination: { limit, count: page.length, hasMore, nextCursor }, filters };
  }

  private sanitize(input: ExternalJobInput, client: ExternalApiClient): SanitizedExternalJob {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('O corpo da requisição deve ser um objeto JSON.');
    const title = this.requiredText(input.title, 'title', 180);
    const description = this.requiredText(input.description, 'description', 20_000);
    const city = this.optionalText(input.city, 'city', 120) || 'Pirassununga';
    const state = (this.optionalText(input.state, 'state', 2) || 'SP').toUpperCase();
    if (!this.validStates.has(state)) throw new BadRequestException('state deve ser uma UF brasileira válida.');
    const sourceName = this.optionalText(input.sourceName, 'sourceName', 160) || client.sourceLabel;
    const companyName = this.optionalText(input.companyName, 'companyName', 160) || sourceName;
    const sourceUrl = this.optionalText(input.sourceUrl, 'sourceUrl', 2_000);
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new BadRequestException('sourceUrl deve começar com http:// ou https://.');
    const sourceExternalId = this.optionalText(input.sourceExternalId, 'sourceExternalId', 120);
    const pcdMode = (this.optionalText(input.pcdMode, 'pcdMode', 16) || 'GENERAL').toUpperCase();
    if (!['GENERAL', 'INCLUSIVE', 'EXCLUSIVE'].includes(pcdMode)) throw new BadRequestException('pcdMode deve ser GENERAL, INCLUSIVE ou EXCLUSIVE.');
    const applicationEmail = this.optionalText(input.applicationEmail, 'applicationEmail', 254)?.toLowerCase() || null;
    if (applicationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationEmail)) throw new BadRequestException('applicationEmail inválido.');
    const whatsappInput = this.optionalText(input.applicationWhatsApp, 'applicationWhatsApp', 30);
    const applicationWhatsApp = whatsappInput ? whatsappInput.replace(/\D/g, '') : null;
    if (applicationWhatsApp && (applicationWhatsApp.length < 10 || applicationWhatsApp.length > 13)) throw new BadRequestException('applicationWhatsApp deve conter DDD e número, com DDI opcional.');
    const deadlineDate = this.optionalText(input.deadlineDate, 'deadlineDate', 10);
    if (deadlineDate && !this.isIsoDate(deadlineDate)) throw new BadRequestException('deadlineDate deve usar o formato YYYY-MM-DD.');
    return {
      title, description, city, state, location: `${city}, ${state}`, sourceName, sourceUrl,
      requirements: this.optionalText(input.requirements, 'requirements', 20_000),
      type: this.optionalText(input.type, 'type', 40) || 'Não informado',
      workModel: this.optionalText(input.workModel, 'workModel', 40) || 'Não informado',
      salary: this.optionalText(input.salary, 'salary', 80), pcdMode, applicationEmail, applicationWhatsApp,
      externalApplicationInstructions: this.optionalText(input.externalApplicationInstructions, 'externalApplicationInstructions', 5_000),
      deadlineDate,
      isTalentPool: this.optionalBoolean(input.isTalentPool, 'isTalentPool') || false,
      isFlagged: this.optionalBoolean(input.isFlagged, 'isFlagged') || false,
      flagObservation: this.optionalText(input.flagObservation, 'flagObservation', 1000), companyName, sourceExternalId,
      sourcePublishedAt: this.optionalDate(input.sourcePublishedAt, 'sourcePublishedAt'),
      lastVerifiedAt: this.optionalDate(input.lastVerifiedAt, 'lastVerifiedAt'),
      lastSeenAt: this.optionalDate(input.lastSeenAt, 'lastSeenAt'),
      flagReason: this.optionalText(input.flagReason, 'flagReason', 120),
      flaggedAt: this.optionalDate(input.flaggedAt, 'flaggedAt'),
      flaggedBy: this.optionalText(input.flaggedBy, 'flaggedBy', 120),
    };
  }

  private optionalBoolean(value: unknown, field: string): boolean | null { if (value === undefined || value === null || value === '') return null; if (typeof value === 'boolean') return value; if (value === 'true') return true; if (value === 'false') return false; throw new BadRequestException(`${field} deve ser um valor booleano.`); }
  private optionalDate(value: unknown, field: string): Date | null { if (value === undefined || value === null || value === '') return null; if (typeof value !== 'string') throw new BadRequestException(`${field} deve ser uma string de data (ISO-8601).`); const date = new Date(value); if (isNaN(date.getTime())) throw new BadRequestException(`${field} deve ser uma data válida.`); return date; }
  private requiredText(value: unknown, field: string, maxLength: number) { const result = this.optionalText(value, field, maxLength); if (!result) throw new BadRequestException(`${field} é obrigatório.`); return result; }
  private optionalText(value: unknown, field: string, maxLength: number) { if (value === undefined || value === null || value === '') return null; if (typeof value !== 'string') throw new BadRequestException(`${field} deve ser texto.`); return value.trim().slice(0, maxLength) || null; }
  private isIsoDate(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) return false; const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))); return date.toISOString().slice(0, 10) === value; }
  private normalize(value: unknown) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  private tokens(value: unknown) { return new Set(this.normalize(value).split(' ').filter((token) => token.length > 2)); }
  private similarity(left: unknown, right: unknown) { const a = this.tokens(left); const b = this.tokens(right); if (!a.size || !b.size) return 0; const intersection = [...a].filter((value) => b.has(value)).length; return intersection / (a.size + b.size - intersection); }
  private catalogFilters(query: JobCatalogQuery): CatalogFilters {
    const state = this.queryText(query.state, 'state', 2).toUpperCase();
    if (state && !this.validStates.has(state)) throw new BadRequestException('state deve ser uma UF brasileira válida.');
    const pcdMode = this.queryText(query.pcdMode, 'pcdMode', 16).toUpperCase();
    if (pcdMode && !['GENERAL', 'INCLUSIVE', 'EXCLUSIVE'].includes(pcdMode)) throw new BadRequestException('pcdMode deve ser GENERAL, INCLUSIVE ou EXCLUSIVE.');
    return {
      q: this.queryText(query.q, 'q', 300),
      active: this.queryBoolean(query.active, 'active'),
      external: this.queryBoolean(query.external, 'external'),
      city: this.queryText(query.city, 'city', 120),
      state,
      type: this.queryText(query.type, 'type', 40),
      workModel: this.queryText(query.workModel, 'workModel', 40),
      companyId: this.queryText(query.companyId, 'companyId', 100),
      pcdMode,
    };
  }
  private queryText(value: unknown, field: string, maxLength: number) { if (value === undefined || value === null || value === '') return ''; if (typeof value !== 'string') throw new BadRequestException(`${field} deve ser informado uma única vez.`); return value.trim().slice(0, maxLength); }
  private queryBoolean(value: unknown, field: string): boolean | null { if (value === undefined || value === null || value === '') return null; if (value === 'true') return true; if (value === 'false') return false; throw new BadRequestException(`${field} deve ser true ou false.`); }
  private encodeCursor(createdAt: Date, id: string, filterHash: string, client: ExternalApiClient) { const payload = { version: 1, createdAt: createdAt.toISOString(), id, filterHash }; const signature = this.cursorSignature(payload, client); return Buffer.from(JSON.stringify({ ...payload, signature })).toString('base64url'); }
  private decodeCursor(token: string, filterHash: string, client: ExternalApiClient) { try { if (typeof token !== 'string' || token.length > 1_024) throw new Error('invalid cursor'); const payload = JSON.parse(Buffer.from(token, 'base64url').toString()) as { version?: unknown; createdAt?: unknown; id?: unknown; filterHash?: unknown; signature?: unknown }; if (payload.version !== 1 || typeof payload.createdAt !== 'string' || typeof payload.id !== 'string' || typeof payload.filterHash !== 'string' || typeof payload.signature !== 'string' || payload.filterHash !== filterHash || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload.createdAt) || !/^[0-9a-f-]{36}$/i.test(payload.id)) throw new Error('invalid cursor'); const expected = this.cursorSignature({ version: payload.version, createdAt: payload.createdAt, id: payload.id, filterHash: payload.filterHash }, client); const suppliedBuffer = Buffer.from(payload.signature); const expectedBuffer = Buffer.from(expected); if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) throw new Error('invalid cursor'); return { createdAt: new Date(payload.createdAt), id: payload.id }; } catch { throw new BadRequestException('Cursor inválido, expirado ou incompatível com os filtros atuais.'); } }
  private cursorSignature(payload: { version: number; createdAt: string; id: string; filterHash: string }, client: ExternalApiClient) { return createHmac('sha256', client.keyHash).update(`${payload.version}|${payload.createdAt}|${payload.id}|${payload.filterHash}`).digest('base64url'); }

  private catalogResult(job: Job) {
    return {
      id: job.id, slug: job.slug, title: job.title, description: job.description, requirements: job.requirements,
      companyId: job.companyId, companyName: job.companyName, isExternalListing: job.isExternalListing,
      sourceName: job.sourceName, sourceUrl: job.sourceUrl, city: job.city, state: job.state, location: job.location,
      type: job.type, workModel: job.workModel, salary: job.salary, pcdMode: job.pcdMode, deadlineDate: job.deadlineDate,
      acceptsPlatformApplications: job.acceptsPlatformApplications,
      externalApplicationInstructions: job.externalApplicationInstructions, applicationEmail: job.applicationEmail,
      applicationWhatsApp: job.applicationWhatsApp, isConfidential: job.isConfidential, isTalentPool: job.isTalentPool,
      isSponsored: job.isSponsored, active: job.active, moderationStatus: job.moderationStatus,
      reportCount: job.reportCount, ingestionSourceId: job.ingestionSourceId, ingestionSourceName: job.ingestionSourceName,
      isFlagged: job.isFlagged, flagObservation: job.flagObservation, flagReason: job.flagReason,
      flaggedAt: job.flaggedAt, flaggedBy: job.flaggedBy, sourceExternalId: job.sourceExternalId,
      sourcePublishedAt: job.sourcePublishedAt, lastVerifiedAt: job.lastVerifiedAt, lastSeenAt: job.lastSeenAt,
      createdAt: job.createdAt, updatedAt: job.updatedAt,
    };
  }

  private publicResult(job: Job) { return this.catalogResult(job); }

  private async nextSlug(base: string) {
    const root = slugify(base) || 'vaga';
    let slug = root;
    let suffix = 2;
    while (await this.jobs.findOne({ where: { slug } })) slug = `${root}-${suffix++}`;
    return slug;
  }

  private async log(clientId: string, action: string, jobId: string | null, result: string, metadata: Record<string, unknown> | null) {
    await this.requests.save(this.requests.create({ clientId, action, jobId, result, metadata }));
  }
}
