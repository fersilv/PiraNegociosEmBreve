import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { PaymentCheckoutStatusService } from '../payments/payment-checkout-status.service';
import type { PaymentCheckoutPayer } from '../payments/payment-provider-manager.service';
import { CompanyPlansOverviewService } from './company-plans-overview.service';
import { CompanyPlansService } from './company-plans.service';

@Controller('company/plans')
@UseGuards(FirebaseAuthGuard)
export class CompanyPlansController {
  constructor(
    private readonly plans: CompanyPlansService,
    private readonly overview: CompanyPlansOverviewService,
    private readonly checkoutStatus: PaymentCheckoutStatusService,
  ) {}

  @Get()
  getPlans(@Req() req: any) {
    return this.overview.getForUser(req.user.uid);
  }

  @Get('checkout/latest')
  latestCheckout(@Req() req: any) {
    return this.plans.latestCheckout(req.user.uid);
  }

  @Post('checkout')
  async checkout(
    @Req() req: any,
    @Body() body: { plan?: string; payer?: PaymentCheckoutPayer },
  ) {
    const result: any = await this.plans.createCheckout(req.user.uid, body?.plan, body?.payer || {});
    const paymentId = String(result?.paymentId || result?.id || '').trim();
    if (paymentId && result?.paymentRequired !== false) {
      this.checkoutStatus.watchForUser(req.user.uid, paymentId);
    }
    return paymentId ? { ...result, id: paymentId, paymentId } : result;
  }

  @Patch('cancel-at-period-end')
  cancelAtPeriodEnd(@Req() req: any, @Body() body: { enabled?: boolean }) {
    return this.plans.setCancelAtPeriodEnd(req.user.uid, body?.enabled !== false);
  }
}