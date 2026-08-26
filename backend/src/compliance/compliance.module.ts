import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../admin/admin.guard';
import { User } from '../users/entities/user.entity';
import { IdentityComplianceAdminController, IdentityComplianceController } from './identity-compliance.controller';
import { IdentityComplianceService } from './identity-compliance.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [IdentityComplianceController, IdentityComplianceAdminController],
  providers: [AdminGuard, IdentityComplianceService],
  exports: [IdentityComplianceService],
})
export class ComplianceModule {}
