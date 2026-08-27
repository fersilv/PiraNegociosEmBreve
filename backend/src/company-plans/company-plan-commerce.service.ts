import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommercialPaymentsService, type PurchaseMode } from '../payments/commercial-payments.service';
import { PaymentCheckoutStatusService } from '../payments/payment-checkout-status.service';
import {
  PaymentProviderManagerService,
  type PaymentCheckoutPayer,
} from '../payments/payment-provider-manager.service';
import { PaymentsService } from '../payments/payments.service';
import { CompanyPlansService } from './company-plans.service';

const ELITE_TRIAL_DAYS = 15;
const PRODUCT_BY_PLAN: Record<'PLUS' | 'ELITE', string> = {
  PLUS: 'COMPANY_PLUS_MONTHLY',
  ELITE: 'COMPANY_ELITE_MONTHLY',
};

@Injectable()
export class CompanyPlanCommerceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly plans: CompanyPlansService,
    private readonly commercial: CommercialPaymentsService,
    private readonly payments: PaymentsService,
    private readonly providers: PaymentProviderManagerService,
    private readonly checkoutStatus: PaymentCheckoutStatusService,
  ) {}

  private normalizePlan(value: unknown): 'PLUS' | 'ELITE' {
    const plan = String(value || '').trim().toUpperCase();
    if (plan !== 'PLUS' && plan !== 'ELITE') {
      throw new BadRequestException('Selecione um plano Plus ou Elite.');
    }
    return plan;
  }

  private normalizeMode(value: unknown): PurchaseMode {
    const mode = String(value || 'SUBSCRIPTION').trim().toUpperCase();
    if (mode !== 'SUBSCRIPTION' && mode !== 'ONE_TIME') {
      throw new BadRequestException('Modalidade de compra inválida.');
    }
    return mode;
  }

  private metadataObject(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
    try { return JSON.parse(String(value || '{}')); } catch { return {}; }
  }

  private async currentAccessMode(companyId: string): Promise<PurchaseMode | null> {
    const rows = await this.dataSource.query(
      `SELECT "cancelAtPeriodEnd", metadata
       FROM company_plan_subscriptions
       WHERE "companyId" = $1 AND status IN ('ACTIVE','PAST_DUE') AND "currentPeriodEnd" > now()
       LIMIT 1`,
      [companyId],
    ).catch(() => []);
    const row = rows[0];
    if (!row) return null;
    const metadata = this.metadataObject(row.metadata);
    const explicit = String(metadata.purchaseMode || '').toUpperCase();
    if (explicit === 'ONE_TIME' || explicit === 'SUBSCRIPTION') return explicit;
    return row.cancelAtPeriodEnd === true ? 'ONE_TIME' : 'SUBSCRIPTION';
  }

  async enrichOverview(payload: any) {
    const companyId = String(payload?.company?.id || '').trim();
    const [plus, elite, routes, currentPurchaseMode] = await Promise.all([
      this.commercial.getProduct(PRODUCT_BY_PLAN.PLUS, true).catch(() => null),
      this.commercial.getProduct(PRODUCT_BY_PLAN.ELITE, true).catch(() => null),
      this.providers.publicRoutes().catch(() => ({})),
      companyId ? this.currentAccessMode(companyId) : Promise.resolve(null),
    ]);
    const byPlan: Record<string, any> = { PLUS: plus, ELITE: elite };

    const plans = Array.isArray(payload?.plans)
      ? payload.plans.map((plan: any) => {
          if (plan.id === 'FREE') return { ...plan, offers: null };
          const product = byPlan[plan.id];
          if (!product) {
            return {
              ...plan,
              offers: {
                subscription: { enabled: false, available: false, paymentType: 'PIX_AUTOMATICO' },
                oneTime: { enabled: false, available: false, paymentType: 'PIX' },
              },
            };
          }

          const subscription = product.offers?.subscription || {};
          const oneTime = product.offers?.oneTime || {};
          const subscriptionRoute = routes?.PIX_AUTOMATICO || {};
          const oneTimeRoute = routes?.PIX || {};
          const subscriptionBenefitIds = this.plans.resolveCommercialBenefitIds(plan.id, product.subscriptionBenefits);
          const oneTimeBenefitIds = this.plans.resolveCommercialBenefitIds(plan.id, product.oneTimeBenefits);
          const subscriptionBenefits = this.plans.resolveCommercialBenefits(plan.id, subscriptionBenefitIds);
          const oneTimeBenefits = this.plans.resolveCommercialBenefits(plan.id, oneTimeBenefitIds);
          const oneTimeSet = new Set(oneTimeBenefitIds);
          const lostComparedToSubscription = subscriptionBenefits.filter((benefit) => !oneTimeSet.has(benefit.id));

          return {
            ...plan,
            productCode: product.code,
            preferredPurchaseMode: product.preferredPurchaseMode,
            durationDays: Number(product.durationDays || 30),
            priceCents: Number(subscription.effectivePriceCents ?? oneTime.effectivePriceCents ?? plan.priceCents ?? 0),
            effectivePriceCents: Number(subscription.effectivePriceCents ?? oneTime.effectivePriceCents ?? plan.effectivePriceCents ?? 0),
            offers: {
              subscription: {
                ...subscription,
                enabled: subscription.enabled === true,
                available: subscription.enabled === true && subscriptionRoute.available === true,
                benefitIds: subscriptionBenefitIds,
                benefits: subscriptionBenefits,
                unavailableReason: subscription.enabled !== true
                  ? 'Assinatura indisponível para este plano.'
                  : subscriptionRoute.available !== true
                    ? 'Assinatura temporariamente indisponível.'
                    : null,
              },
              oneTime: {
                ...oneTime,
                enabled: oneTime.enabled === true,
                available: oneTime.enabled === true && oneTimeRoute.available === true,
                benefitIds: oneTimeBenefitIds,
                benefits: oneTimeBenefits,
                lostComparedToSubscription,
                unavailableReason: oneTime.enabled !== true
                  ? 'Compra avulsa indisponível para este plano.'
                  : oneTimeRoute.available !== true
                    ? 'Compra avulsa temporariamente indisponível.'
                    : null,
              },
            },
          };
        })
      : [];

    const recurring = currentPurchaseMode === 'SUBSCRIPTION';
    return {
      ...payload,
      plans,
      current: payload?.current ? { ...payload.current, purchaseMode: currentPurchaseMode } : payload?.current,
      billing: payload?.billing
        ? {
            ...payload.billing,
            purchaseMode: currentPurchaseMode,
            hasRecurringSubscription: Boolean(payload.billing.hasPaidSubscription && recurring),
            renewalEnabled: recurring ? payload.billing.renewalEnabled : false,
            nextChargeAt: recurring ? payload.billing.nextChargeAt : null,
            nextChargeCents: recurring ? payload.billing.nextChargeCents : null,
            statusLabel: currentPurchaseMode === 'ONE_TIME' && payload.billing.plan !== 'FREE'
              ? 'Acesso avulso ativo'
              : payload.billing.statusLabel,
          }
        : payload?.billing,
    };
  }

  async createCheckout(
    userId: string,
    requestedPlan: unknown,
    purchaseModeInput: unknown,
    payer: PaymentCheckoutPayer = {},
  ) {
    const plan = this.normalizePlan(requestedPlan);
    const purchaseMode = this.normalizeMode(purchaseModeInput);
    const company = await this.plans.managedCompany(userId);
    const [current, product, trialRows, routes] = await Promise.all([
      this.plans.getCompanyPlan(company.id),
      this.commercial.getProduct(PRODUCT_BY_PLAN[plan], false),
      this.dataSource.query(`SELECT 1 FROM company_plan_trials WHERE "companyId" = $1 LIMIT 1`, [company.id]).catch(() => []),
      this.providers.publicRoutes(),
    ]);

    if (purchaseMode === 'SUBSCRIPTION' && !current.isTrial && current.basePlan === plan && current.hasPaidSubscription && !current.cancelAtPeriodEnd) {
      throw new BadRequestException(`A empresa já possui a assinatura ${plan} ativa.`);
    }
    if (purchaseMode === 'ONE_TIME' && current.hasPaidSubscription && !current.cancelAtPeriodEnd) {
      throw new BadRequestException('Existe uma assinatura recorrente ativa. Cancele a renovação ou aguarde o fim do período antes de comprar acesso avulso.');
    }

    const offer = purchaseMode === 'SUBSCRIPTION' ? product.offers?.subscription : product.offers?.oneTime;
    if (!offer?.enabled || offer?.effectivePriceCents === null || offer?.effectivePriceCents === undefined) {
      throw new BadRequestException(
        purchaseMode === 'SUBSCRIPTION'
          ? 'A assinatura deste plano está desativada.'
          : 'A compra avulsa deste plano está desativada.',
      );
    }

    const paymentType = purchaseMode === 'SUBSCRIPTION' ? 'PIX_AUTOMATICO' : 'PIX';
    const route = routes?.[paymentType];
    if (!route?.available) {
      throw new ServiceUnavailableException(
        purchaseMode === 'SUBSCRIPTION'
          ? 'A assinatura está temporariamente indisponível. Tente novamente mais tarde.'
          : 'A compra avulsa está temporariamente indisponível. Tente novamente mais tarde.',
      );
    }

    const basePrice = Number(offer.priceCents);
    const amountCents = Number(offer.effectivePriceCents);
    if (!Number.isFinite(basePrice) || !Number.isFinite(amountCents) || basePrice <= 0 || amountCents <= 0) {
      throw new BadRequestException('Esta modalidade não possui um preço válido para cobrança.');
    }
    const trialDays = purchaseMode === 'SUBSCRIPTION' && trialRows.length === 0 && !current.hasPaidSubscription
      ? ELITE_TRIAL_DAYS
      : 0;
    const discountCents = Math.max(0, basePrice - amountCents);
    const configuredBenefits = purchaseMode === 'SUBSCRIPTION'
      ? product.subscriptionBenefits
      : product.oneTimeBenefits;
    const companyBenefitIds = this.plans.resolveCommercialBenefitIds(plan, configuredBenefits);
    const metadata = {
      companyId: company.id,
      companyName: company.name,
      companyPlan: plan,
      companyWhatsAppPlan: true,
      companyPurchaseMode: purchaseMode,
      purchaseMode,
      paymentType,
      companyBenefitIds,
      promotionActive: offer.promotionActive === true,
      companyEliteTrialDays: trialDays,
      companyEliteTrialPending: trialDays > 0,
    };

    const inserted = await this.dataSource.query(
      `INSERT INTO payments
        ("userId", "productCode", method, status, "originalAmountCents", "amountCents",
         "discountCents", provider, "purchaseMode", metadata)
       VALUES ($1,$2,'PIX','PENDING',$3,$4,$5,NULL,$6,$7::jsonb)
       RETURNING *`,
      [
        userId,
        product.code,
        basePrice,
        amountCents,
        discountCents,
        purchaseMode,
        JSON.stringify(metadata),
      ],
    );
    const payment = inserted[0];
    const paymentId = String(payment.id);
    const providerProduct = {
      ...product,
      billingType: purchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME',
      priceCents: basePrice,
      originalPriceCents: basePrice,
      effectivePriceCents: amountCents,
    };
    const providerPayment = { ...payment, purchaseMode, product: providerProduct };

    const devMode = await this.payments.getDevMode();
    if (devMode.enabled) {
      if (purchaseMode === 'SUBSCRIPTION' && trialDays > 0) {
        await this.payments.activateCompanyPlanTrial(paymentId, {
          provider: 'DEV',
          providerSubscriptionId: `dev-${paymentId}`,
        });
        return {
          ...providerPayment,
          id: paymentId,
          paymentId,
          plan,
          purchaseMode,
          benefitIds: companyBenefitIds,
          trialDays,
          company: { id: company.id, name: company.name },
          paymentRequired: false,
          checkoutReady: false,
          devSimulation: true,
          trialActivated: true,
        };
      }
      const settled = await this.payments.simulatePayment(paymentId, userId);
      return {
        ...providerPayment,
        ...settled,
        id: paymentId,
        paymentId,
        plan,
        purchaseMode,
        benefitIds: companyBenefitIds,
        trialDays: 0,
        company: { id: company.id, name: company.name },
        paymentRequired: false,
        checkoutReady: false,
        devSimulation: true,
      };
    }

    try {
      const checkout = await this.providers.createCheckout(providerPayment, payer, { trialDays });
      const stored = await this.payments.attachProviderCheckout(paymentId, checkout);
      const storedMetadata = this.metadataObject(stored.metadata);
      const response = {
        ...stored,
        id: paymentId,
        paymentId,
        plan,
        purchaseMode,
        benefitIds: companyBenefitIds,
        billingType: purchaseMode === 'SUBSCRIPTION' ? 'RECURRING' : 'ONE_TIME',
        product: providerProduct,
        trialDays,
        company: { id: company.id, name: company.name },
        checkoutReady: Boolean(
          stored.pixCopyPaste
          || stored.qrCodeBase64
          || storedMetadata.ticketUrl
          || storedMetadata.subscriptionCheckoutUrl,
        ),
        providerConfigured: true,
        paymentRequired: true,
        trialStartsAfterAuthorization: purchaseMode === 'SUBSCRIPTION' && trialDays > 0,
      };
      this.checkoutStatus.watchForUser(userId, paymentId);
      return response;
    } catch (error) {
      await this.payments.cancelProviderCheckout(paymentId, error).catch(() => undefined);
      throw error;
    }
  }
}