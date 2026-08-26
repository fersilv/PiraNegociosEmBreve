import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { User } from '../users/entities/user.entity';
import { CnpjLookupService } from './cnpj-lookup.service';
import { CompanyVerificationAuthorizationService } from './company-verification-authorization.service';
import {
  CompanyVerificationAdminController,
  CompanyVerificationController,
  CompanyVerificationPublicController,
} from './company-verification.controller';
import { CompanyVerificationEmailService } from './company-verification-email.service';
import { IdentityComplianceAdminController, IdentityComplianceController } from './identity-compliance.controller';
import { IdentityComplianceService } from './identity-compliance.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [
    IdentityComplianceController,
    IdentityComplianceAdminController,
    CompanyVerificationController,
    CompanyVerificationPublicController,
    CompanyVerificationAdminController,
  ],
  providers: [
    AdminGuard,
    IdentityComplianceService,
    CnpjLookupService,
    CompanyVerificationEmailService,
    CompanyVerificationAuthorizationService,
  ],
  exports: [
    IdentityComplianceService,
    CnpjLookupService,
    CompanyVerificationAuthorizationService,
  ],
})
export class ComplianceModule {}
