import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../companies/entities/company.entity';
import { Application } from '../applications/entities/application.entity';
import { CompanyAccessRequest } from '../companies/entities/company-access-request.entity';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { VisitorEvent } from '../analytics/entities/visitor-event.entity';
import { AccountAccess } from '../analytics/entities/account-access.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company, Job, Application, CompanyAccessRequest, VisitorEvent, AccountAccess])],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
