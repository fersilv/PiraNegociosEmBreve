import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import type { PaymentCheckoutPayer } from '../payments/payment-provider-manager.service';
import type { PurchaseMode } from '../payments/commercial-payments.service';
import { CompanyPlanCommerceService } from './company-plan-commerce.service';
import { CompanyPlansOverviewService } from './company-plans-overview.service';
import { CompanyPlansService } from './company-plans.service';

@Controller('company/plans')
@UseGuards(FirebaseAuthGuard)
export class CompanyPlansController {
  constructor(
    private readonly plans: CompanyPlansService,
    private readonly overview: CompanyPlansOverviewService,
    private readonly commerce: CompanyPlanCommerceService,
  ) {}

  @Get()
  async getPlans(@Req() req: any) {
    const base = await this.overview.getForUser(req.user.uid);
    return this.commerce.enrichOverview(base);
  }

  @Get('checkout/latest')
  latestCheckout(@Req() req: any) {
    return this.plans.latestCheckout(req.user.uid);
  }

  @Post('checkout')
  checkout(
    @Req() req: any,
    @Body() body: {
      plan?: string;
      purchaseMode?: PurchaseMode;
      payer?: PaymentCheckoutPayer;
    },
  ) {
    return this.commerce.createCheckout(
      req.user.uid,
      body?.plan,
      body?.purchaseMode || 'SUBSCRIPTION',
      body?.payer || {},
    );
  }

  @Patch('cancel-at-period-end')
  cancelAtPeriodEnd(@Req() req: any, @Body() body: { enabled?: boolean }) {
    return this.plans.setCancelAtPeriodEnd(req.user.uid, body?.enabled !== false);
  }
}
