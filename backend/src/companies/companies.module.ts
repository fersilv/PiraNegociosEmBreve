import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { CompanyInvitation } from '../users/entities/company-invitation.entity';
import { CompanyAccessRequest } from './entities/company-access-request.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompanyTalentFolder } from './entities/company-talent-folder.entity';
import { CompanyTalentRecord } from './entities/company-talent-record.entity';
import { CompanyCandidateNote } from './entities/company-candidate-note.entity';
import { CompanyTalentInvite } from './entities/company-talent-invite.entity';
import { Job } from '../jobs/entities/job.entity';
import { Application } from '../applications/entities/application.entity';
import { TalentInvitesController } from './talent-invites.controller';
import { CompanySlugAlias } from './entities/company-slug-alias.entity';
import { CompanyHiringConfigController } from './company-hiring-config.controller';
import { HiringConfigCompatController } from './hiring-config-compat.controller';
import { CompanyPage } from './entities/company-page.entity';
import { CompanyPagePreview } from './entities/company-page-preview.entity';
import { CompanyPagesService } from './company-pages.service';
import { CompanyPagesController } from './company-pages.controller';
import { CompanyPagesPublicController } from './company-pages-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      User,
      CompanyInvitation,
      CompanyAccessRequest,
      CompanyTalentFolder,
      CompanyTalentRecord,
      CompanyCandidateNote,
      CompanyTalentInvite,
      Job,
      Application,
      CompanySlugAlias,
      CompanyPage,
      CompanyPagePreview,
    ]),
  ],
  providers: [CompaniesService, CompanyPagesService],
  controllers: [
    CompaniesController,
    CompanyPagesController,
    CompanyPagesPublicController,
    TalentInvitesController,
    CompanyHiringConfigController,
    HiringConfigCompatController,
  ],
})
export class CompaniesModule {}
