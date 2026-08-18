import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { ApiKeyGuard } from './api-key.guard';
import { ExternalApiAdminController } from './external-api-admin.controller';
import { ExternalApiController } from './external-api.controller';
import { ExternalJobsService } from './external-jobs.service';
import { ExternalApiClient } from './entities/external-api-client.entity';
import { ExternalApiRequest } from './entities/external-api-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExternalApiClient,
      ExternalApiRequest,
      Job,
      User,
    ]),
  ],
  controllers: [ExternalApiController, ExternalApiAdminController],
  providers: [ApiKeyGuard, AdminGuard, ExternalJobsService],
})
export class ExternalApiModule {}
