import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
import { EfiPixService } from './efi-pix.service';
import { MercadoPagoService } from './mercado-pago.service';
import { MercadoPagoTestLabService } from './mercado-pago-test-lab.service';
import {
  PaymentProviderManagerService,
  type PaymentCheckoutPayer,
} from './payment-provider-manager.service';

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly billingSupport: BillingSupportService,
    private readonly providers: PaymentProviderManagerService,
  ) {}

  @Get('catalog')
  getCatalog() {
    return this.payments.listCatalog(false);
  }

  @Get('provider')
  getPaymentRoutes() {
    return this.providers.publicRoutes();
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
  async createPix(
    @Req() req: any,
    @Body() body: { productCode?: string; payer?: PaymentCheckoutPayer },
  ) {
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

    try {
      const checkout = await this.providers.createCheckout(payment, body?.payer || {});
      const stored = await this.payments.attachProviderCheckout(payment.id, checkout);
      const metadata = stored.metadata as any;
      return {
        ...stored,
        product: payment.product,
        checkoutReady: Boolean(
          stored.pixCopyPaste
          || stored.qrCodeBase64
          || metadata?.ticketUrl
          || metadata?.subscriptionCheckoutUrl,
        ),
        providerConfigured: true,
        paymentRequired: true,
      };
    } catch (error) {
      await this.payments.cancelProviderCheckout(payment.id, error).catch(() => undefined);
      throw error;
    }
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

@Controller('payments/webhooks/efi')
export class EfiPaymentsWebhookController {
  constructor(private readonly efiPix: EfiPixService) {}

  @Post()
  async receive(@Body() body: any, @Query('hmac') hmac?: string) {
    if (Array.isArray(body?.pix)) return this.efiPix.handlePixWebhook(body, hmac);
    if (Array.isArray(body?.recs) || Array.isArray(body?.rec)) {
      return this.efiPix.handleAutomaticRecurrenceWebhook(body, hmac);
    }
    if (Array.isArray(body?.cobsr)) return this.efiPix.handleAutomaticChargeWebhook(body, hmac);
    return { ok: true, test: true };
  }
}

@Controller('payments/webhooks/mercado-pago')
export class MercadoPagoPaymentsWebhookController {
  constructor(private readonly mercadoPago: MercadoPagoService) {}

  @Post()
  receive(
    @Body() body: any,
    @Query() query: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.mercadoPago.handleWebhook(body, query, headers);
  }
}

@Controller('admin/payments')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly billingSupport: BillingSupportService,
    private readonly productDuration: ProductDurationService,
    private readonly providers: PaymentProviderManagerService,
    private readonly mercadoPagoTests: MercadoPagoTestLabService,
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

  @Get('mercado-pago-tests')
  mercadoPagoTestOverview() {
    return this.mercadoPagoTests.overview();
  }

  @Patch('mercado-pago-tests/:profile')
  saveMercadoPagoTestProfile(
    @Req() req: any,
    @Param('profile') profile: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.mercadoPagoTests.saveProfile(profile, body || {}, req.user.uid);
  }

  @Post('mercado-pago-tests/:profile/credentials')
  testMercadoPagoCredentials(@Req() req: any, @Param('profile') profile: string) {
    return this.mercadoPagoTests.testCredentials(profile, req.user.uid);
  }

  @Post('mercado-pago-tests/orders/create')
  createMercadoPagoTestOrder(@Req() req: any) {
    return this.mercadoPagoTests.createOrder(req.user.uid);
  }

  @Get('mercado-pago-tests/orders/:orderId')
  getMercadoPagoTestOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return this.mercadoPagoTests.getOrder(orderId, req.user.uid);
  }

  @Post('mercado-pago-tests/subscriptions/create')
  createMercadoPagoTestSubscription(@Req() req: any) {
    return this.mercadoPagoTests.createSubscription(req.user.uid);
  }

  @Get('mercado-pago-tests/subscriptions/:preapprovalId')
  getMercadoPagoTestSubscription(@Req() req: any, @Param('preapprovalId') preapprovalId: string) {
    return this.mercadoPagoTests.getSubscription(preapprovalId, req.user.uid);
  }

  @Post('mercado-pago-tests/marketplace/create')
  createMercadoPagoTestSplit(@Req() req: any) {
    return this.mercadoPagoTests.createMarketplaceSplit(req.user.uid);
  }

  @Get('mercado-pago-tests/marketplace/:paymentId')
  getMercadoPagoTestSplit(@Req() req: any, @Param('paymentId') paymentId: string) {
    return this.mercadoPagoTests.getMarketplacePayment(paymentId, req.user.uid);
  }

  @Get('providers')
  getProviders() {
    return this.providers.list();
  }

  @Get('providers/routes')
  getProviderRoutes() {
    return this.providers.routes();
  }

  @Get('providers/vault-status')
  getProviderVaultStatus() {
    return this.providers.vaultStatus();
  }

  @Get('providers/:code')
  getProvider(@Param('code') code: string) {
    return this.providers.get(code);
  }

  @Patch('providers/:code')
  saveProvider(
    @Req() req: any,
    @Param('code') code: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.providers.save(code, body || {}, req.user.uid);
  }

  @Post('providers/:code/test')
  testProvider(@Req() req: any, @Param('code') code: string) {
    return this.providers.test(code, req.user.uid);
  }

  @Post('providers/:code/activate')
  activateProvider(
    @Req() req: any,
    @Param('code') code: string,
    @Body() body: { paymentType?: string },
  ) {
    if (!body?.paymentType) throw new BadRequestException('Informe o tipo de pagamento que este provedor atenderá.');
    return this.providers.activate(code, body.paymentType, req.user.uid);
  }

  @Post('providers/routes/:paymentType/deactivate')
  deactivateProviderRoute(@Req() req: any, @Param('paymentType') paymentType: string) {
    return this.providers.deactivate(paymentType, req.user.uid);
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
    return this.billingSupport.setCreditBalance(
      userId,
      rawFeature as FeatureCredit,
      Number(body?.quantity || 0),
      req.user.uid,
      body?.note,
    );
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
