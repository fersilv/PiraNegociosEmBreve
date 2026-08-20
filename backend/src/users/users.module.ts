import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { Company } from '../companies/entities/company.entity';
import { CandidatesController } from './candidates.controller';
import { Institution } from './entities/institution.entity';
import { AdminModule } from '../admin/admin.module';

import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CompanyInvitation, Company, Institution]),
    AnalyticsModule,
    AdminModule,
  ],
  controllers: [UsersController, CandidatesController, InstitutionsController],
  providers: [UsersService, InstitutionsService],
})
export class UsersModule {}
