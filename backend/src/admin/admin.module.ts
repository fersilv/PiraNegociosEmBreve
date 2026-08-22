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
import { UserSanction } from './entities/user-sanction.entity';
import { JobReport } from '../jobs/entities/job-report.entity';
import { CompanySlugAlias } from '../companies/entities/company-slug-alias.entity';
import { Setting } from './entities/setting.entity';

import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AdminAiController } from './admin-ai.controller';
import { AdminJobDetailsController } from './admin-job-details.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Company,
      Job,
      Application,
      CompanyAccessRequest,
      VisitorEvent,
      AccountAccess,
      UserSanction,
      JobReport,
      CompanySlugAlias,
      Setting,
    ]),
  ],
  controllers: [
    AdminController,
    AdminJobDetailsController,
    SettingsController,
    AdminAiController,
  ],
  providers: [AdminGuard, SettingsService],
  exports: [SettingsService],
})
export class AdminModule {}
