import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { Job } from './entities/job.entity';
import { User } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { JobReport } from './entities/job-report.entity';
import { JobsGateway } from './jobs.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Job, User, Company, JobReport])],
  controllers: [JobsController],
  providers: [JobsService, JobsGateway],
})
export class JobsModule {}
