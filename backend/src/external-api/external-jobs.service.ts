import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
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
  applicationEmail?: unknown;
  applicationWhatsApp?: unknown;
  externalApplicationInstructions?: unknown;
  deadlineDate?: unknown;
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
  applicationEmail: string | null;
  applicationWhatsApp: string | null;
  externalApplicationInstructions: string | null;
  deadlineDate: string | null;
};

@Injectable()
export class ExternalJobsService {
  private readonly validStates = new Set([
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ]);

  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(ExternalApiRequest)
    private readonly requests: Repository<ExternalApiRequest>,
  ) {}

  async check(input: ExternalJobInput, client: ExternalApiClient) {
    const match = await this.findDuplicate(input, client);
    await this.log(
      client.id,
      'CHECK',
      match.job?.id || null,
      match.duplicate ? 'DUPLICATE' : 'AVAILABLE',
      { confidence: match.confidence },
    );
    return match;
  }

  async findDuplicate(input: ExternalJobInput, client: ExternalApiClient) {
    const data = this.sanitize(input, client);
    const fingerprint = createHash('sha256')
      .update(
        `${this.normalize(data.title)}|${this.normalize(data.sourceName)}|${this.normalize(data.city)}|${data.state}`,
      )
      .digest('hex');
    const exactWhere: FindOptionsWhere<Job>[] = [
      { externalFingerprint: fingerprint },
    ];
    if (data.sourceUrl) exactWhere.push({ sourceUrl: data.sourceUrl });
    const exact = await this.jobs.findOne({ where: exactWhere });
    if (exact) {
      return {
        duplicate: true,
        confidence: 1,
        job: this.publicResult(exact),
        fingerprint,
        data,
      };
    }

    const recent = await this.jobs.find({
      order: { createdAt: 'DESC' },
      take: 500,
    });
    let best: { job: Job; score: number } | null = null;
    for (const job of recent) {
      const titleScore = this.similarity(data.title, job.title);
      const sourceScore = this.similarity(
        data.sourceName,
        job.sourceName || job.companyName,
      );
      const samePlace =
        this.normalize(data.city) ===
          this.normalize(job.city || job.location) &&
        data.state === (job.state || 'SP');
      const score =
        titleScore * 0.65 + sourceScore * 0.2 + (samePlace ? 0.15 : 0);
      if (!best || score > best.score) best = { job, score };
    }

    if (best && best.score >= 0.82) {
      return {
        duplicate: true,
        confidence: Number(best.score.toFixed(2)),
        job: this.publicResult(best.job),
        fingerprint,
        data,
      };
    }
    return {
      duplicate: false,
      confidence: best ? Number(best.score.toFixed(2)) : 0,
      closestJob: best ? this.publicResult(best.job) : null,
      fingerprint,
      data,
    };
  }

  async create(input: ExternalJobInput, client: ExternalApiClient) {
    const match = await this.findDuplicate(input, client);
    if (match.duplicate) {
      await this.log(client.id, 'CREATE', match.job?.id || null, 'DUPLICATE', {
        confidence: match.confidence,
      });
      return match;
    }

    const data = match.data;
    const slug = await this.nextSlug(`${data.title}-${data.sourceName}`);
    try {
      const job = await this.jobs.save(
        this.jobs.create({
          ...data,
          ownerId: `api:${client.id}`,
          companyId: null,
          companyName: data.sourceName,
          isExternalListing: true,
          externalFingerprint: match.fingerprint,
          ingestionSourceId: client.id,
          ingestionSourceName: client.name,
          moderationStatus: 'PENDING',
          acceptsPlatformApplications: false,
          active: false,
          slug,
        }),
      );
      await this.log(client.id, 'CREATE', job.id, 'CREATED', null);
      return {
        duplicate: false,
        created: true,
        moderationStatus: job.moderationStatus,
        job: this.publicResult(job),
      };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        const concurrentMatch = await this.findDuplicate(input, client);
        await this.log(
          client.id,
          'CREATE',
          concurrentMatch.job?.id || null,
          'DUPLICATE',
          { confidence: concurrentMatch.confidence, concurrent: true },
        );
        return concurrentMatch;
      }
      throw error;
    }
  }

  async list(query: string, limit: number, client: ExternalApiClient) {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), 100)
      : 25;
    const jobs = await this.jobs.find({
      where: { isExternalListing: true },
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
    await this.log(client.id, 'LIST', null, 'OK', { query });
    const term = this.normalize(query);
    return jobs
      .filter(
        (job) =>
          !term ||
          this.normalize(
            `${job.title} ${job.sourceName || ''} ${job.location || ''}`,
          ).includes(term),
      )
      .map((job) => this.publicResult(job));
  }

  private sanitize(
    input: ExternalJobInput,
    client: ExternalApiClient,
  ): SanitizedExternalJob {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException(
        'O corpo da requisição deve ser um objeto JSON.',
      );

    const title = this.requiredText(input.title, 'title', 180);
    const description = this.requiredText(
      input.description,
      'description',
      20_000,
    );
    const city = this.optionalText(input.city, 'city', 120) || 'Pirassununga';
    const state = (
      this.optionalText(input.state, 'state', 2) || 'SP'
    ).toUpperCase();
    if (!this.validStates.has(state))
      throw new BadRequestException('state deve ser uma UF brasileira válida.');

    const sourceName =
      this.optionalText(input.sourceName, 'sourceName', 160) ||
      client.sourceLabel;
    const sourceUrl = this.optionalText(input.sourceUrl, 'sourceUrl', 2_000);
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl))
      throw new BadRequestException(
        'sourceUrl deve começar com http:// ou https://.',
      );

    const applicationEmail =
      this.optionalText(
        input.applicationEmail,
        'applicationEmail',
        254,
      )?.toLowerCase() || null;
    if (
      applicationEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationEmail)
    )
      throw new BadRequestException('applicationEmail inválido.');

    const whatsappInput = this.optionalText(
      input.applicationWhatsApp,
      'applicationWhatsApp',
      30,
    );
    const applicationWhatsApp = whatsappInput
      ? whatsappInput.replace(/\D/g, '')
      : null;
    if (
      applicationWhatsApp &&
      (applicationWhatsApp.length < 10 || applicationWhatsApp.length > 13)
    )
      throw new BadRequestException(
        'applicationWhatsApp deve conter DDD e número, com DDI opcional.',
      );

    const deadlineDate = this.optionalText(
      input.deadlineDate,
      'deadlineDate',
      10,
    );
    if (deadlineDate && !this.isIsoDate(deadlineDate))
      throw new BadRequestException(
        'deadlineDate deve usar o formato YYYY-MM-DD.',
      );

    return {
      title,
      description,
      city,
      state,
      location: `${city}, ${state}`,
      sourceName,
      sourceUrl,
      requirements: this.optionalText(
        input.requirements,
        'requirements',
        20_000,
      ),
      type: this.optionalText(input.type, 'type', 40) || 'Não informado',
      workModel:
        this.optionalText(input.workModel, 'workModel', 40) || 'Presencial',
      salary: this.optionalText(input.salary, 'salary', 80),
      applicationEmail,
      applicationWhatsApp,
      externalApplicationInstructions: this.optionalText(
        input.externalApplicationInstructions,
        'externalApplicationInstructions',
        5_000,
      ),
      deadlineDate,
    };
  }

  private requiredText(value: unknown, field: string, maxLength: number) {
    const result = this.optionalText(value, field, maxLength);
    if (!result) throw new BadRequestException(`${field} é obrigatório.`);
    return result;
  }

  private optionalText(value: unknown, field: string, maxLength: number) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string')
      throw new BadRequestException(`${field} deve ser texto.`);
    return value.trim().slice(0, maxLength) || null;
  }

  private isIsoDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
    return date.toISOString().slice(0, 10) === value;
  }

  private normalize(value: unknown) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private tokens(value: unknown) {
    return new Set(
      this.normalize(value)
        .split(' ')
        .filter((token) => token.length > 2),
    );
  }

  private similarity(left: unknown, right: unknown) {
    const a = this.tokens(left);
    const b = this.tokens(right);
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter((value) => b.has(value)).length;
    return intersection / (a.size + b.size - intersection);
  }

  private publicResult(job: Job) {
    return {
      id: job.id,
      title: job.title,
      sourceName: job.sourceName,
      sourceUrl: job.sourceUrl,
      city: job.city,
      state: job.state,
      location: job.location,
      active: job.active,
      moderationStatus: job.moderationStatus,
      ingestionSourceName: job.ingestionSourceName,
      createdAt: job.createdAt,
    };
  }

  private log(
    clientId: string,
    action: string,
    jobId: string | null,
    result: string,
    metadata: Record<string, unknown> | null,
  ) {
    return this.requests.save(
      this.requests.create({ clientId, action, jobId, result, metadata }),
    );
  }

  private async nextSlug(value: string) {
    const base = slugify(value) || 'vaga';
    for (let suffix = 1; suffix < 10_000; suffix += 1) {
      const candidate = suffix === 1 ? base : `${base}-${suffix}`;
      if (!(await this.jobs.exists({ where: { slug: candidate } })))
        return candidate;
    }
    throw new BadRequestException('Não foi possível gerar slug.');
  }
}
