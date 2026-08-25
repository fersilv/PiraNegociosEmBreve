import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import type { PaymentCheckoutPayer } from '../payments/payment-provider-manager.service';
import { CompanyPlansService } from './company-plans.service';

@Controller('company/plans')
@UseGuards(FirebaseAuthGuard)
export class CompanyPlansController {
  constructor(private readonly plans: CompanyPlansService) {}

  @Get()
  getPlans(@Req() req: any) {
    return this.plans.getForUser(req.user.uid);
  }

  @Get('checkout/latest')
  latestCheckout(@Req() req: any) {
    return this.plans.latestCheckout(req.user.uid);
  }

  @Post('checkout')
  checkout(
    @Req() req: any,
    @Body() body: { plan?: string; payer?: PaymentCheckoutPayer },
  ) {
    return this.plans.createCheckout(req.user.uid, body?.plan, body?.payer || {});
  }

  @Patch('cancel-at-period-end')
  cancelAtPeriodEnd(@Req() req: any, @Body() body: { enabled?: boolean }) {
    return this.plans.setCancelAtPeriodEnd(req.user.uid, body?.enabled !== false);
  }
}
