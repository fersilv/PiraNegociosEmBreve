import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { PaymentsService, type FeatureCredit } from './payments.service';
import { BillingSupportService, type TimedFeature } from './billing-support.service';
import { ProductDurationService } from './product-duration.service';

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly billingSupport: BillingSupportService,
  ) {}

  @Get('catalog')
  getCatalog() {
    return this.payments.listCatalog(false);
  }

  @Get('me')
  getMine(@Req() req: any) {
    return this.payments.listUserPayments(req.user.uid);
  }

  @Get('me/credits')
  getMyCredits(@Req() req: any) {
    return this.payments.getCredits(req.user.uid);
  }

  @Get('me/billing-status')
  getMyBillingStatus(@Req() req: any) {
    return this.billingSupport.getMyBillingStatus(req.user.uid);
  }

  @Post('pix')
  async createPix(@Req() req: any, @Body() body: { productCode?: string }) {
    const productCode = String(body?.productCode || '').trim();
    if (!productCode) throw new BadRequestException('Informe o produto que deseja comprar.');

    const lifetimeActivation = await this.billingSupport.activateLifetimeProduct(req.user.uid, productCode);
    if (lifetimeActivation) {
      return {
        ...lifetimeActivation,
        paymentRequired: false,
        checkoutReady: false,
        message: 'Conta vitalícia: este recurso não exige pagamento.',
      };
    }

    const payment = await this.payments.createPixPayment(req.user.uid, productCode);
    const devMode = await this.payments.getDevMode();
    if (devMode.enabled) {
      const settled = await this.payments.simulatePayment(payment.id, req.user.uid);
      return {
        ...payment,
        ...settled,
        product: payment.product,
        paymentRequired: false,
        checkoutReady: false,
        providerConfigured: false,
        devSimulation: true,
        message: 'Modo DEV: pagamento simulado e benefício liberado automaticamente, sem contabilizar receita real.',
      };
    }

    return payment;
  }

  @Get('me/resume-history')
  async getResumeHistory(@Req() req: any) {
    const [analyses, improvements, publications] = await Promise.all([
      this.payments.listAnalysisHistory(req.user.uid),
      this.payments.listImprovementHistory(req.user.uid),
      this.payments.listPublicationHistory(req.user.uid),
    ]);
    return { analyses, improvements, publications };
  }
}

@Controller('admin/payments')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly billingSupport: BillingSupportService,
    private readonly productDuration: ProductDurationService,
  ) {}

  @Get('dev-mode')
  getDevMode() {
    return this.payments.getDevMode();
  }

  @Patch('dev-mode')
  setDevMode(@Body() body: { enabled?: boolean }) {
    if (typeof body?.enabled !== 'boolean') throw new BadRequestException('enabled deve ser true ou false.');
    return this.payments.setDevMode(body.enabled);
  }

  @Get('performance')
  performance() {
    return this.payments.productPerformance();
  }

  @Get('products')
  getProducts() {
    return this.payments.listCatalog(true);
  }

  @Patch('products/:code')
  updateProduct(@Param('code') code: string, @Body() body: Record<string, unknown>) {
    return this.payments.updateProduct(code, body || {});
  }

  @Patch('products/:code/duration')
  updateProductDuration(@Param('code') code: string, @Body() body: { durationDays?: number }) {
    return this.productDuration.update(code, Number(body?.durationDays));
  }

  @Get('summary')
  summary() {
    return this.payments.paymentSummary();
  }

  @Get('users')
  searchUsers(@Query('q') query?: string, @Query('limit') limit?: string) {
    return this.billingSupport.searchUsers(query || '', Number(limit || 30));
  }

  @Get('users/:userId/support')
  getUserSupport(@Param('userId') userId: string) {
    return this.billingSupport.getUserSupport(userId);
  }

  @Patch('users/:userId/lifetime')
  setLifetime(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { enabled?: boolean; note?: string },
  ) {
    return this.billingSupport.setLifetimeFree(userId, body?.enabled === true, req.user.uid, body?.note);
  }

  @Patch('users/:userId/credits/:feature')
  setCreditBalance(
    @Req() req: any,
    @Param('userId') userId: string,
    @Param('feature') rawFeature: string,
    @Body() body: { quantity?: number; note?: string },
  ) {
    const feature = rawFeature as FeatureCredit;
    return this.billingSupport.setCreditBalance(userId, feature, Number(body?.quantity || 0), req.user.uid, body?.note);
  }

  @Post('users/:userId/entitlements/:feature')
  grantEntitlement(
    @Req() req: any,
    @Param('userId') userId: string,
    @Param('feature') rawFeature: string,
    @Body() body: { durationDays?: number; note?: string },
  ) {
    return this.billingSupport.grantTimedFeature(
      userId,
      rawFeature as TimedFeature,
      Number(body?.durationDays || 30),
      req.user.uid,
      body?.note,
    );
  }

  @Post('users/:userId/entitlements/:feature/revoke')
  revokeEntitlement(
    @Req() req: any,
    @Param('userId') userId: string,
    @Param('feature') rawFeature: string,
    @Body() body: { note?: string },
  ) {
    return this.billingSupport.revokeTimedFeature(userId, rawFeature as TimedFeature, req.user.uid, body?.note);
  }

  @Post('users/:userId/subscriptions')
  activateSubscription(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() body: { productCode?: string; durationDays?: number; note?: string },
  ) {
    return this.billingSupport.activateSubscription(
      userId,
      String(body?.productCode || 'PREMIUM_MONTHLY'),
      req.user.uid,
      body?.durationDays,
      body?.note,
    );
  }

  @Patch('users/:userId/subscriptions/:subscriptionId')
  updateSubscriptionStatus(
    @Req() req: any,
    @Param('userId') userId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' },
  ) {
    if (!body?.status) throw new BadRequestException('Informe o status da assinatura.');
    return this.billingSupport.setSubscriptionStatus(userId, subscriptionId, body.status, req.user.uid);
  }

  @Get()
  list(@Query('limit') limit?: string) {
    return this.payments.listAllPayments(Number(limit || 200));
  }

  @Post(':id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.payments.confirmPayment(id, {
      confirmedByAdmin: req.user.uid,
      confirmationMode: 'ADMIN_MANUAL',
    });
  }

  @Post(':id/simulate')
  simulate(@Req() req: any, @Param('id') id: string) {
    return this.payments.simulatePayment(id, req.user.uid);
  }

  @Post('credits/:userId')
  grantCredit(
    @Param('userId') userId: string,
    @Body() body: { feature?: FeatureCredit; quantity?: number },
  ) {
    const feature = String(body?.feature || '') as FeatureCredit;
    if (!['RESUME_REANALYSIS', 'RESUME_AI_IMPROVEMENT', 'RESUME_AI_IMPORT'].includes(feature)) {
      throw new BadRequestException('Recurso de crédito inválido.');
    }
    return this.payments.grantCredit(userId, feature, Number(body?.quantity || 1));
  }
}
