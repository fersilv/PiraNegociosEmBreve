import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { Job } from './entities/job.entity';
import { User } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { JobReport } from './entities/job-report.entity';
import { JobsGateway } from './jobs.gateway';
import { CompanyTalentInvite } from '../companies/entities/company-talent-invite.entity';
import { Application } from '../applications/entities/application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      User,
      Company,
      JobReport,
      CompanyTalentInvite,
      Application,
    ]),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsGateway],
  exports: [JobsService],
})
export class JobsModule {}
