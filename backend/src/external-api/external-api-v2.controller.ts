import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JobMatchService } from '../job-match/job-match.service';
import { ApiKeyGuard } from './api-key.guard';
import { ExternalApiClient } from './entities/external-api-client.entity';
import {
  ExternalJobInput,
  ExternalJobsService,
  JobCatalogQuery,
} from './external-jobs.service';
import { hasJobsScope } from './jobs-mcp.scopes';
import { JobsOperationsService } from './jobs-operations.service';

type ExternalJobWithMatchInput = ExternalJobInput & { matchProfile?: unknown };

@Controller('v2/jobs')
@UseGuards(ApiKeyGuard)
export class ExternalApiV2Controller {
  constructor(
    private readonly jobs: ExternalJobsService,
    private readonly operations: JobsOperationsService,
    private readonly jobMatch: JobMatchService,
  ) {}

  @Get('stats')
  stats(@Req() req: any) {
    this.requireScope(req, 'jobs:stats:read');
    return this.operations.stats();
  }

  @Get('review')
  reviewQueue(
    @Req() req: any,
    @Query()
    query: {
      status?: string;
      active?: string;
      city?: string;
      state?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    this.requireScope(req, 'jobs:review:read');
    return this.operations.reviewQueue({
      status: query.status,
      active: query.active === undefined ? undefined : query.active === 'true',
      city: query.city,
      state: query.state,
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 30),
    });
  }

  @Get()
  list(@Req() req: any, @Query() query: JobCatalogQuery) {
    this.requireScope(req, 'jobs:list');
    return this.jobs.list(query, req.apiClient);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    this.requireScope(req, 'jobs:detail');
    return this.operations.get(id);
  }

  @Post('check')
  check(@Req() req: any, @Body() input: ExternalJobWithMatchInput) {
    this.requireScope(req, 'jobs:duplicates:check');
    return this.jobs.check(input, req.apiClient);
  }

  @Post()
  async create(@Req() req: any, @Body() input: ExternalJobWithMatchInput) {
    this.requireScope(req, 'jobs:create');
    const result: any = await this.jobs.create(input, req.apiClient);
    if (input?.matchProfile !== undefined && result?.created && result?.job?.id) {
      const matchProfile = await this.jobMatch.acceptProvidedProfile(
        result.job.id,
        input.matchProfile,
      );
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
    this.requireScope(req, 'jobs:update');
    if (input?.matchProfile !== undefined) {
      this.jobMatch.stageProvidedProfile(id, input.matchProfile);
    }
    try {
      const result: any = await this.jobs.update(id, input, req.apiClient);
      if (input?.matchProfile !== undefined && result?.job?.id) {
        const matchProfile = await this.jobMatch.acceptProvidedProfile(
          result.job.id,
          input.matchProfile,
        );
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
    this.requireScope(req, 'jobs:verify');
    if (input?.matchProfile !== undefined) {
      this.jobMatch.stageProvidedProfile(id, input.matchProfile);
    }
    try {
      const result: any = await this.jobs.verify(id, input, req.apiClient);
      if (input?.matchProfile !== undefined && result?.job?.id) {
        const matchProfile = await this.jobMatch.acceptProvidedProfile(
          result.job.id,
          input.matchProfile,
        );
        return { ...result, matchProfile };
      }
      return result;
    } finally {
      this.jobMatch.clearStagedProvidedProfile(id);
    }
  }

  @Post(':id/activate')
  activate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    this.requireScope(req, 'jobs:activate');
    return this.operations.setActive(id, true, this.actor(req.apiClient), body?.note);
  }

  @Post(':id/deactivate')
  deactivate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    this.requireScope(req, 'jobs:deactivate');
    return this.operations.setActive(id, false, this.actor(req.apiClient), body?.note);
  }

  @Patch(':id/review')
  review(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status?: string; note?: string },
  ) {
    this.requireScope(req, 'jobs:review:write');
    return this.operations.setReview(
      id,
      String(body?.status || ''),
      this.actor(req.apiClient),
      body?.note,
    );
  }

  @Post(':id/flag')
  flag(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string; observation?: string },
  ) {
    this.requireScope(req, 'jobs:flag');
    return this.operations.flag(id, this.actor(req.apiClient), body || {});
  }

  @Post(':id/unflag')
  unflag(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    this.requireScope(req, 'jobs:unflag');
    return this.operations.clearFlag(id, this.actor(req.apiClient), body?.note);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    this.requireScope(req, 'jobs:delete');
    return this.operations.remove(id);
  }

  private requireScope(req: any, scope: string) {
    const client = req.apiClient as ExternalApiClient | undefined;
    if (!client || !hasJobsScope(client.scopes || [], scope)) {
      throw new ForbiddenException(`Esta chave não possui o escopo ${scope}.`);
    }
  }

  private actor(client: ExternalApiClient) {
    return `api-v2:${client.id}:${client.name}`.slice(0, 160);
  }
}
