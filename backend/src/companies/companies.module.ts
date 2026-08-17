import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { CompanyInvitation } from '../users/entities/company-invitation.entity';
import { CompanyAccessRequest } from './entities/company-access-request.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, User, CompanyInvitation, CompanyAccessRequest])],
  providers: [CompaniesService],
  controllers: [CompaniesController],
})
export class CompaniesModule {}
