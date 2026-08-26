import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { ApplicationsModule } from '../applications/applications.module';
import { Application } from '../applications/entities/application.entity';
import { CompaniesModule } from '../companies/companies.module';
import { CompanyCandidateNote } from '../companies/entities/company-candidate-note.entity';
import { CompanyTalentFolder } from '../companies/entities/company-talent-folder.entity';
import { CompanyTalentRecord } from '../companies/entities/company-talent-record.entity';
import { Job } from '../jobs/entities/job.entity';
import { PaymentsModule } from '../payments/payments.module';
import { User } from '../users/entities/user.entity';
import { CompanyPlansAdminController } from './company-plans-admin.controller';
import { CompanyPlansAdminService } from './company-plans-admin.service';
import { CompanyPlansController } from './company-plans.controller';
import { CompanyPlansOverviewService } from './company-plans-overview.service';
import { CompanyPlansService } from './company-plans.service';
import { CompanyWhatsAppPremiumService } from './company-whatsapp-premium.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      Application,
      User,
      CompanyTalentFolder,
      CompanyTalentRecord,
      CompanyCandidateNote,
    ]),
    PaymentsModule,
    ApplicationsModule,
    CompaniesModule,
  ],
  controllers: [CompanyPlansController, CompanyPlansAdminController],
  providers: [
    CompanyPlansService,
    CompanyPlansOverviewService,
    CompanyPlansAdminService,
    CompanyWhatsAppPremiumService,
    AdminGuard,
  ],
  exports: [CompanyPlansService, CompanyWhatsAppPremiumService],
})
export class CompanyPlansModule {}
