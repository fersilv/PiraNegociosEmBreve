import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { COMPANY_PLAN_CATALOG, CompanyPlan, CompanyPlansService } from './company-plans.service';

@Injectable()
export class CompanyPlansOverviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly plans: CompanyPlansService,
  ) {}

  async getForUser(userId: string) {
    const company = await this.plans.managedCompany(userId);
    let degraded = false;
    let payload: any;

    try {
      payload = await this.plans.getForUser(userId);
    } catch {
      degraded = true;
      payload = this.fallback(company);
    }

    const current = payload.current || this.freeCurrent();
    const basePlan = this.normalizePlan(current.basePlan || current.plan);
    const currentCatalog = (payload.plans || []).find((plan: any) => plan.id === basePlan)
      || COMPANY_PLAN_CATALOG.find((plan) => plan.id === basePlan)
      || COMPANY_PLAN_CATALOG[0];

    const [subscription, latestCheckout] = await Promise.all([
      this.subscription(company.id),
      this.plans.latestCheckout(userId).catch(() => null),
    ]);

    const configuredPriceCents = Number(
      currentCatalog?.effectivePriceCents
      ?? currentCatalog?.priceCents
      ?? 0,
    );
    const storedPriceCents = this.firstMoney(
      subscription?.amountCents,
      subscription?.priceCents,
      subscription?.monthlyPriceCents,
      subscription?.metadata?.priceCents,
    );
    const priceCents = storedPriceCents ?? configuredPriceCents;
    const cancelAtPeriodEnd = Boolean(current.cancelAtPeriodEnd || subscription?.cancelAtPeriodEnd);
    const periodStart = current.currentPeriodStart || subscription?.currentPeriodStart || null;
    const periodEnd = current.currentPeriodEnd || subscription?.currentPeriodEnd || null;
    const paidPeriodEnd = current.paidCurrentPeriodEnd || subscription?.currentPeriodEnd || null;
    const isTrial = Boolean(current.isTrial);
    const hasPaidSubscription = Boolean(current.hasPaidSubscription || subscription);
    const renewable = hasPaidSubscription && !cancelAtPeriodEnd;
    const nextChargeAt = cancelAtPeriodEnd
      ? null
      : isTrial
        ? current.trialEndsAt || periodEnd
        : hasPaidSubscription
          ? paidPeriodEnd || periodEnd
          : null;
    const nextChargeCents = nextChargeAt ? priceCents : null;

    return {
      ...payload,
      company: payload.company || { id: company.id, name: company.name },
      current,
      degraded,
      billing: {
        currency: 'BRL',
        plan: basePlan,
        planName: currentCatalog?.name || basePlan,
        status: current.status || 'FREE',
        statusLabel: this.statusLabel(current.status, isTrial, cancelAtPeriodEnd),
        priceCents,
        periodStart,
        periodEnd,
        nextChargeAt,
        nextChargeCents,
        cancelAtPeriodEnd,
        renewalEnabled: renewable,
        provider: current.provider || subscription?.provider || null,
        providerSubscriptionId: current.providerSubscriptionId || subscription?.providerSubscriptionId || null,
        isTrial,
        trialEndsAt: current.trialEndsAt || null,
        trialTargetPlan: current.trialTargetPlan || null,
        hasPaidSubscription,
        latestCheckout: latestCheckout ? {
          id: latestCheckout.id,
          status: latestCheckout.status || latestCheckout.paymentStatus || null,
          productCode: latestCheckout.productCode || null,
          productName: latestCheckout.productName || null,
          createdAt: latestCheckout.createdAt || null,
          paidAt: latestCheckout.paidAt || latestCheckout.approvedAt || null,
          provider: latestCheckout.provider || latestCheckout.paymentProvider || null,
        } : null,
      },
      scopes: this.planScopes(basePlan),
      warnings: degraded
        ? ['Os dados de assinatura estão temporariamente indisponíveis. O catálogo e o plano Free continuam acessíveis enquanto o banco de cobrança é atualizado.']
        : [],
    };
  }

  private async subscription(companyId: string) {
    return this.dataSource.query(
      `SELECT * FROM company_plan_subscriptions
       WHERE "companyId"=$1
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [companyId],
    ).then((rows) => rows[0] || null).catch(() => null);
  }

  private fallback(company: any) {
    const current = this.freeCurrent();
    return {
      company: { id: company.id, name: company.name },
      current,
      trial: {
        days: 15,
        active: false,
        eligibleOnSubscription: true,
        used: false,
        targetPlan: null,
        startedAt: null,
        endsAt: null,
        restrictions: [],
      },
      plans: COMPANY_PLAN_CATALOG.map((plan) => ({
        ...plan,
        current: plan.id === 'FREE',
        available: true,
        includesEliteTrial: plan.id !== 'FREE',
        eliteTrialDays: plan.id !== 'FREE' ? 15 : 0,
      })),
    };
  }

  private freeCurrent() {
    return {
      plan: 'FREE' as CompanyPlan,
      basePlan: 'FREE' as CompanyPlan,
      rank: 0,
      active: false,
      status: 'FREE',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      paidCurrentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      provider: null,
      providerSubscriptionId: null,
      isSimulation: false,
      isTrial: false,
      trialEndsAt: null,
      trialTargetPlan: null,
      hasPaidSubscription: false,
      advertisingEligible: false,
      jobHighlightEligible: false,
    };
  }

  private normalizePlan(value: unknown): CompanyPlan {
    const plan = String(value || '').toUpperCase();
    return plan === 'ELITE' ? 'ELITE' : plan === 'PLUS' ? 'PLUS' : 'FREE';
  }

  private firstMoney(...values: unknown[]) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number) && number >= 0) return Math.round(number);
    }
    return null;
  }

  private statusLabel(status: unknown, isTrial: boolean, cancelAtPeriodEnd: boolean) {
    if (isTrial) return 'Período gratuito';
    if (cancelAtPeriodEnd) return 'Cancelamento agendado';
    const value = String(status || '').toUpperCase();
    if (value === 'ACTIVE') return 'Ativo';
    if (value === 'PAST_DUE') return 'Pagamento pendente';
    if (value === 'EXPIRED') return 'Expirado';
    return 'Gratuito';
  }

  private planScopes(plan: CompanyPlan) {
    return {
      recruitment: {
        label: 'Recrutamento',
        summary: plan === 'FREE'
          ? 'Operações essenciais pelo WhatsApp e painel web da empresa.'
          : plan === 'PLUS'
            ? 'Mais gestão de vagas e candidatos pelo WhatsApp.'
            : 'Gestão avançada de recrutamento pelo WhatsApp e benefícios promocionais pagos.',
      },
      marketplace: {
        label: 'Marketplace',
        photoLimit: 10,
        onlineSales: true,
        auctionCreation: plan === 'ELITE',
        summary: plan === 'ELITE'
          ? 'Anúncios empresariais, vendas online e criação de leilões.'
          : 'Anúncios empresariais e vendas online; criação de leilões exige Elite.',
      },
    };
  }
}
