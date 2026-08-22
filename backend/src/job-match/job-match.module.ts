import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module';
import { AdminGuard } from '../admin/admin.guard';
import { PaymentsModule } from '../payments/payments.module';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { JobMatchAdminService } from './job-match-admin.service';
import { JobMatchAiService } from './job-match-ai.service';
import { AdminJobMatchController, JobMatchController } from './job-match.controller';
import { JobMatchService } from './job-match.service';
import { JobMatchSubscriber } from './job-match.subscriber';

@Module({
  imports: [AdminModule, PaymentsModule, TypeOrmModule.forFeature([Job, User])],
  controllers: [JobMatchController, AdminJobMatchController],
  providers: [AdminGuard, JobMatchAiService, JobMatchService, JobMatchAdminService, JobMatchSubscriber],
  exports: [JobMatchService],
})
export class JobMatchModule {}
