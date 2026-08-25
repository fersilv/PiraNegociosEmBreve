import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { JobMatchModule } from '../job-match/job-match.module';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { ApiKeyGuard } from './api-key.guard';
import { ExternalApiAdminController } from './external-api-admin.controller';
import { ExternalApiController } from './external-api.controller';
import { ExternalApiV2Controller } from './external-api-v2.controller';
import { ExternalJobsService } from './external-jobs.service';
import { ExternalApiClient } from './entities/external-api-client.entity';
import { ExternalApiRequest } from './entities/external-api-request.entity';
import {
  JobsOAuthClient,
  JobsOAuthCode,
  JobsOAuthToken,
} from './entities/jobs-oauth.entity';
import { JobsIntegrationsAdminController } from './jobs-integrations-admin.controller';
import { JobsMcpController } from './jobs-mcp.controller';
import { JobsOAuthController } from './jobs-oauth.controller';
import { JobsOAuthGuard } from './jobs-oauth.guard';
import { JobsOAuthService } from './jobs-oauth.service';
import { JobsOperationsService } from './jobs-operations.service';

@Module({
  imports: [
    JobMatchModule,
    TypeOrmModule.forFeature([
      ExternalApiClient,
      ExternalApiRequest,
      JobsOAuthClient,
      JobsOAuthCode,
      JobsOAuthToken,
      Job,
      User,
    ]),
  ],
  controllers: [
    JobsOAuthController,
    JobsMcpController,
    ExternalApiController,
    ExternalApiV2Controller,
    ExternalApiAdminController,
    JobsIntegrationsAdminController,
  ],
  providers: [
    ApiKeyGuard,
    AdminGuard,
    ExternalJobsService,
    JobsOperationsService,
    JobsOAuthGuard,
    JobsOAuthService,
  ],
  exports: [JobsOAuthService],
})
export class ExternalApiModule {}
