import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ExternalJobsService } from './external-jobs.service';
import type { ExternalJobInput } from './external-jobs.service';

@Controller('v1/jobs')
@UseGuards(ApiKeyGuard)
export class ExternalApiController {
  constructor(private readonly jobs: ExternalJobsService) {}
  @Get() list(
    @Req() req: any,
    @Query('q') query = '',
    @Query('limit') limit = '25',
  ) {
    return this.jobs.list(query, Number(limit), req.apiClient);
  }
  @Post('check') check(@Req() req: any, @Body() input: ExternalJobInput) {
    return this.jobs.check(input, req.apiClient);
  }
  @Post() create(@Req() req: any, @Body() input: ExternalJobInput) {
    return this.jobs.create(input, req.apiClient);
  }
}
