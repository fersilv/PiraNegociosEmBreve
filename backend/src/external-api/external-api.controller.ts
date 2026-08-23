import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  JOB_MATCH_ALGORITHM_VERSION,
  JobMatchService,
} from '../job-match/job-match.service';
import { ApiKeyGuard } from './api-key.guard';
import { ExternalJobsService } from './external-jobs.service';
import type {
  ExternalJobInput,
  JobCatalogQuery,
} from './external-jobs.service';

type ExternalJobWithMatchInput = ExternalJobInput & { matchProfile?: unknown };

@Controller('v1/jobs')
@UseGuards(ApiKeyGuard)
export class ExternalApiController {
  constructor(
    private readonly jobs: ExternalJobsService,
    private readonly jobMatch: JobMatchService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('match-profile-schema')
  matchProfileSchema() {
    return {
      field: 'matchProfile',
      optional: true,
      purpose: 'Permite que uma IA de ingestão envie a ficha estruturada da vaga e evite uma segunda chamada de IA interna quando a ficha for aceita.',
      requiredFields: ['canonicalRole', 'occupationalFamily'],
      requirementTypes: ['SKILL', 'EXPERIENCE', 'EDUCATION', 'CERTIFICATION', 'LICENSE', 'OTHER'],
      schema: {
        canonicalRole: 'string',
        occupationalFamily: 'string',
        occupationKeywords: ['string'],
        technicalSkills: [{ name: 'string', required: 'boolean', weight: 'number 0.1..5', evidenceTerms: ['string'] }],
        requirements: [{ label: 'string', type: 'SKILL|EXPERIENCE|EDUCATION|CERTIFICATION|LICENSE|OTHER', required: 'boolean', weight: 'number 0.1..5', evidenceTerms: ['string'] }],
        softSkills: ['string'],
        summary: 'string',
      },
      example: {
        canonicalRole: 'Operador de Colhedora',
        occupationalFamily: 'Operação de máquinas agrícolas e colheita mecanizada',
        occupationKeywords: ['colhedora', 'máquinas agrícolas', 'colheita mecanizada'],
        technicalSkills: [
          { name: 'Operação de colhedora', required: true, weight: 2, evidenceTerms: ['colhedora', 'máquina de colheita'] },
        ],
        requirements: [
          { label: 'Experiência com operação de colhedora', type: 'EXPERIENCE', required: true, weight: 2, evidenceTerms: ['operação de colhedora', 'colheita mecanizada'] },
        ],
        softSkills: ['Trabalho em equipe'],
        summary: 'Perfil para operação segura de colhedoras e apoio à colheita mecanizada.',
      },
      note: 'A ficha descreve a vaga. Ela nunca define score de candidato; a compatibilidade continua sendo calculada internamente contra cada currículo.',
    };
  }

  @Get('match-profile-status')
  async matchProfileStatus(
    @Query('ready') ready = 'all',
    @Query('active') active = 'true',
    @Query('limit') limit = '500',
    @Query('city') city = '',
    @Query('state') state = '',
  ) {
    const normalizedReady = String(ready || 'all').trim().toLowerCase();
    if (!['true', 'false', 'all'].includes(normalizedReady)) {
      throw new BadRequestException('ready deve ser true, false ou all.');
    }

    const normalizedActive = String(active || 'true').trim().toLowerCase();
    if (!['true', 'false', 'all'].includes(normalizedActive)) {
      throw new BadRequestException('active deve ser true, false ou all.');
    }

    const parsedLimit = Math.round(Number(limit || 500));
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestException('limit deve ser um número inteiro maior que zero.');
    }
    const safeLimit = Math.min(500, parsedLimit);

    const params: unknown[] = [JOB_MATCH_ALGORITHM_VERSION];
    const where: string[] = [];

    if (normalizedActive !== 'all') {
      params.push(normalizedActive === 'true');
      where.push(`j.active = $${params.length}`);
    }

    const cleanCity = String(city || '').trim();
    if (cleanCity) {
      params.push(cleanCity);
      where.push(`LOWER(j.city) = LOWER($${params.length})`);
    }

    const cleanState = String(state || '').trim().toUpperCase();
    if (cleanState) {
      if (!/^[A-Z]{2}$/.test(cleanState)) {
        throw new BadRequestException('state deve ser uma UF com 2 letras.');
      }
      params.push(cleanState);
      where.push(`UPPER(j.state) = $${params.length}`);
    }

    const validReadyExpression = `(p.status = 'READY' AND p."algorithmVersion" = $1)`;
    if (normalizedReady === 'true') where.push(validReadyExpression);
    if (normalizedReady === 'false') where.push(`NOT ${validReadyExpression}`);

    params.push(safeLimit);
    const rows = await this.dataSource.query(
      `SELECT
         j.id,
         j.slug,
         j.title,
         j."companyName",
         j."sourceName",
         j."sourceUrl",
         j."sourceExternalId",
         j.city,
         j.state,
         j.active,
         j."moderationStatus",
         j."createdAt",
         j."updatedAt",
         p.status AS "matchProfileStatus",
         p."algorithmVersion" AS "matchProfileAlgorithmVersion",
         p.error AS "matchProfileError",
         p."analyzedAt" AS "matchProfileAnalyzedAt",
         p."updatedAt" AS "matchProfileUpdatedAt",
         ${validReadyExpression} AS ready
       FROM jobs j
       LEFT JOIN job_match_profiles p ON p."jobId" = j.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY j."createdAt" DESC, j.id DESC
       LIMIT $${params.length}`,
      params,
    );

    return {
      data: rows.map((row: any) => ({
        ...row,
        matchProfileStatus: row.matchProfileStatus || 'MISSING',
        ready: Boolean(row.ready),
      })),
      count: rows.length,
      filters: {
        ready: normalizedReady,
        active: normalizedActive,
        city: cleanCity || null,
        state: cleanState || null,
        limit: safeLimit,
        algorithmVersion: JOB_MATCH_ALGORITHM_VERSION,
      },
    };
  }

  @Get()
  list(@Req() req: any, @Query() query: JobCatalogQuery) {
    return this.jobs.list(query, req.apiClient);
  }

  @Post('check')
  check(@Req() req: any, @Body() input: ExternalJobWithMatchInput) {
    return this.jobs.check(input, req.apiClient);
  }

  @Post()
  async create(@Req() req: any, @Body() input: ExternalJobWithMatchInput) {
    const result: any = await this.jobs.create(input, req.apiClient);
    if (input?.matchProfile !== undefined && result?.created && result?.job?.id) {
      const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
      return { ...result, matchProfile };
    }
    return result;
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() input: ExternalJobWithMatchInput,
  ) {
    if (input?.matchProfile !== undefined) this.jobMatch.stageProvidedProfile(id, input.matchProfile);
    try {
      const result: any = await this.jobs.update(id, input, req.apiClient);
      if (input?.matchProfile !== undefined && result?.job?.id) {
        const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
        return { ...result, matchProfile };
      }
      return result;
    } finally {
      this.jobMatch.clearStagedProvidedProfile(id);
    }
  }

  @Post(':id/verification')
  async verify(
    @Req() req: any,
    @Param('id') id: string,
    @Body() input: any,
  ) {
    if (input?.matchProfile !== undefined) this.jobMatch.stageProvidedProfile(id, input.matchProfile);
    try {
      const result: any = await this.jobs.verify(id, input, req.apiClient);
      if (input?.matchProfile !== undefined && result?.job?.id) {
        const matchProfile = await this.jobMatch.acceptProvidedProfile(result.job.id, input.matchProfile);
        return { ...result, matchProfile };
      }
      return result;
    } finally {
      this.jobMatch.clearStagedProvidedProfile(id);
    }
  }
}
