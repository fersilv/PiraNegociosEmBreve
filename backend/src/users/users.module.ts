import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { Company } from '../companies/entities/company.entity';
import { CandidatesController } from './candidates.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CompanyInvitation, Company]),
    AnalyticsModule,
  ],
  controllers: [UsersController, CandidatesController],
  providers: [UsersService],
})
export class UsersModule {}
