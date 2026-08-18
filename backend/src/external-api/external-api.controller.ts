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
import { ApiKeyGuard } from './api-key.guard';
import { ExternalJobsService } from './external-jobs.service';
import type {
  ExternalJobInput,
  JobCatalogQuery,
} from './external-jobs.service';

@Controller('v1/jobs')
@UseGuards(ApiKeyGuard)
export class ExternalApiController {
  constructor(private readonly jobs: ExternalJobsService) {}
  @Get() list(@Req() req: any, @Query() query: JobCatalogQuery) {
    return this.jobs.list(query, req.apiClient);
  }
  @Post('check') check(@Req() req: any, @Body() input: ExternalJobInput) {
    return this.jobs.check(input, req.apiClient);
  }
  @Post() create(@Req() req: any, @Body() input: ExternalJobInput) {
    return this.jobs.create(input, req.apiClient);
  }
  @Patch(':id') update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() input: ExternalJobInput,
  ) {
    return this.jobs.update(id, input, req.apiClient);
  }
}
