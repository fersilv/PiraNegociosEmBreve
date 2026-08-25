import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '../applications/applications.module';
import { Application } from '../applications/entities/application.entity';
import { CompaniesModule } from '../companies/companies.module';
import { CompanyCandidateNote } from '../companies/entities/company-candidate-note.entity';
import { CompanyTalentFolder } from '../companies/entities/company-talent-folder.entity';
import { CompanyTalentRecord } from '../companies/entities/company-talent-record.entity';
import { Job } from '../jobs/entities/job.entity';
import { PaymentsModule } from '../payments/payments.module';
import { User } from '../users/entities/user.entity';
import { CompanyPlansController } from './company-plans.controller';
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
  controllers: [CompanyPlansController],
  providers: [CompanyPlansService, CompanyWhatsAppPremiumService],
  exports: [CompanyPlansService, CompanyWhatsAppPremiumService],
})
export class CompanyPlansModule {}
