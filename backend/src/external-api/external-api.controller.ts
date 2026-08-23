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
