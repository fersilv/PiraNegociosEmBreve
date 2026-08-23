import {
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
import { JobMatchService } from '../job-match/job-match.service';
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
