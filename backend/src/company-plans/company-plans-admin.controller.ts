import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { CompanyPlansAdminService } from './company-plans-admin.service';

@Controller('admin/company-plans')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class CompanyPlansAdminController {
  constructor(private readonly adminPlans: CompanyPlansAdminService) {}

  @Get(':companyId')
  get(@Param('companyId') companyId: string) {
    return this.adminPlans.get(companyId);
  }

  @Patch(':companyId')
  set(
    @Req() req: any,
    @Param('companyId') companyId: string,
    @Body() body: { plan?: string; currentPeriodEnd?: string | null },
  ) {
    return this.adminPlans.set(companyId, body?.plan, body?.currentPeriodEnd, req.user.uid);
  }
}
