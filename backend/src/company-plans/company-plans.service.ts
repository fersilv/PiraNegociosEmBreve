import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentsService } from '../payments/payments.service';
import {
  PaymentProviderManagerService,
  type PaymentCheckoutPayer,
} from '../payments/payment-provider-manager.service';

export type CompanyPlan = 'FREE' | 'PLUS' | 'ELITE';

/**
 * IMPORTANT: these entitlements apply only to operations performed by the
 * company through the WhatsApp concierge. They must never be used to hide or
 * block the existing company web dashboard functionality.
 */
export type CompanyWhatsAppFeature =
  | 'WHATSAPP_FREE'
  | 'JOB_ACTIVATE'
  | 'JOB_DEACTIVATE'
  | 'JOB_CLOSE'
  | 'CANDIDATES_DETAIL'
  | 'CANDIDATE_PROFILE'
  | 'APPLICATION_STATUS'
  | 'APPLICATION_NOTE'
  | 'CANDIDATE_INVITE'
  | 'CANDIDATE_INVITE_CANCEL'
  | 'TALENT_MANAGE'
  | 'CANDIDATE_WHATSAPP'
  | 'RECENT_APPLICATIONS'
  | 'ADVANCED_JOB_STATS';

const RANK: Record<CompanyPlan, number> = { FREE: 0, PLUS: 1, ELITE: 2 };
const ELITE_TRIAL_DAYS = 15;

export const COMPANY_PLAN_CATALOG = [
  {
    id: 'FREE' as const,
    name: 'Free',
    priceCents: 0,
    monthly: false,
    description: 'Mantém as operações atuais da assistente empresarial no WhatsApp.',
    features: [
      'WhatsApp: listar vagas da empresa',
      'WhatsApp: consultar quantidade de candidaturas por vaga',
      'WhatsApp: consultar candidatos compatíveis',
      'WhatsApp: criar vagas',
      'WhatsApp: editar vagas',
    ],
  },
  {
    id: 'PLUS' as const,
    name: 'Plus',
    priceCents: 1990,
    monthly: true,
    productCode: 'COMPANY_PLUS_MONTHLY',
    description: 'Amplia a operação da assistente no WhatsApp. O painel web continua com os recursos atuais.',
    features: [
      'Tudo do Free no WhatsApp',
      'WhatsApp: ativar vaga',
      'WhatsApp: desativar vaga',
      'WhatsApp: encerrar vaga',
      'WhatsApp: listar candidatos individualmente com detalhes',
      'WhatsApp: abrir perfil e currículo de candidato',
    ],
  },
  {
    id: 'ELITE' as const,
    name: 'Elite',
    priceCents: 4990,
    monthly: true,
    productCode: 'COMPANY_ELITE_MONTHLY',
    description: 'Gestão completa pelo WhatsApp, além dos benefícios promocionais exclusivos da assinatura paga.',
    features: [
      'Tudo do Free e Plus no WhatsApp',
      'WhatsApp: mudar status da candidatura',
      'WhatsApp: adicionar observações internas',
      'WhatsApp: convidar e remover convite de candidato',
      'WhatsApp: adicionar e remover candidatos do Banco de Talentos e pastas',
      'WhatsApp: responder e gerenciar candidatos',
      'WhatsApp: consultar novas candidaturas por período',
      'WhatsApp: estatísticas avançadas das vagas',
      'Elite pago: elegibilidade para destaque das vagas no PiraNegócios',
      'Elite pago: elegibilidade aos destaques do PiraNegócios na Meta e Google',
    ],
  },
] as const;

const WHATSAPP_FEATURE_PLAN: Record<CompanyWhatsAppFeature, CompanyPlan> = {
  WHATSAPP_FREE: 'FREE',
  JOB_ACTIVATE: 'PLUS',
  JOB_DEACTIVATE: 'PLUS',
  JOB_CLOSE: 'PLUS',
  CANDIDATES_DETAIL: 'PLUS',
  CANDIDATE_PROFILE: 'PLUS',
  APPLICATION_STATUS: 'ELITE',
  APPLICATION_NOTE: 'ELITE',
  CANDIDATE_INVITE: 'ELITE',
  CANDIDATE_INVITE_CANCEL: 'ELITE',
  TALENT_MANAGE: 'ELITE',
  CANDIDATE_WHATSAPP: 'ELITE',
  RECENT_APPLICATIONS: 'ELITE',
  ADVANCED_JOB_STATS: 'ELITE',
};

@Injectable()
export class CompanyPlansService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
    private readonly providers: PaymentProviderManagerService,
  ) {}

  private normalizePlan(value: unknown): CompanyPlan {
    const plan = String(value || '').toUpperCase();
    return plan === 'PLUS' || plan === 'ELITE' ? plan : 'FREE';
  }

  async managedCompany(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT c.*, u."isCompanyAdmin", u.type AS "userType"
       FROM users u
       JOIN companies c ON c.id::text = u."companyId" OR c."ownerId" = u.id
       WHERE u.id = $1
         AND (c."ownerId" = u.id OR u."isCompanyAdmin" = true OR u.type = 'ADMIN')
       ORDER BY CASE WHEN c.id::text = u."companyId" THEN 0 ELSE 1 END, c."createdAt" ASC
       LIMIT 1`,
      [userId],
    );
    if (!rows[0]) {
      throw new ForbiddenException('Você não possui uma empresa administrável vinculada a esta conta.');
    }
    return rows[0];
  }

  private async trialForCompany(companyId: string) {
    await this.dataSource.query(
      `UPDATE company_plan_trials
       SET status = 'EXPIRED', "updatedAt" = now()
       WHERE "companyId" = $1 AND status = 'ACTIVE' AND "endsAt" <= now()`,
      [companyId],
    ).catch(() => undefined);
    const rows = await this.dataSource.query(
      `SELECT * FROM company_plan_trials WHERE "companyId" = $1 LIMIT 1`,
      [companyId],
    ).catch(() => []);
    return rows[0] || null;
  }

  async getCompanyPlan(companyId: string) {
    await this.dataSource.query(
      `UPDATE company_plan_subscriptions
       SET status = 'EXPIRED', "updatedAt" = now()
       WHERE "companyId" = $1 AND status IN ('ACTIVE','PAST_DUE') AND "currentPeriodEnd" <= now()`,
      [companyId],
    ).catch(() => undefined);

    const [subscriptionRows, trial] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM company_plan_subscriptions
         WHERE "companyId" = $1 AND status IN ('ACTIVE','PAST_DUE') AND "currentPeriodEnd" > now()
         LIMIT 1`,
        [companyId],
      ),
      this.trialForCompany(companyId),
    ]);
    const subscription = subscriptionRows[0] || null;
    const basePlan = subscription ? this.normalizePlan(subscription.plan) : 'FREE';
    const trialActive = Boolean(
      trial?.status === 'ACTIVE' && new Date(trial.endsAt).getTime() > Date.now(),
    );
    const plan: CompanyPlan = trialActive ? 'ELITE' : basePlan;

    return {
      plan,
      basePlan,
      rank: RANK[plan],
      active: trialActive || basePlan !== 'FREE',
      status: trialActive ? 'TRIAL' : subscription?.status || 'FREE',
      currentPeriodStart: trialActive ? trial.startedAt : subscription?.currentPeriodStart || null,
      currentPeriodEnd: trialActive ? trial.endsAt : subscription?.currentPeriodEnd || null,
      paidCurrentPeriodEnd: subscription?.currentPeriodEnd || null,
      cancelAtPeriodEnd: trialActive ? false : Boolean(subscription?.cancelAtPeriodEnd),
      provider: subscription?.provider || trial?.provider || null,
      providerSubscriptionId: subscription?.providerSubscriptionId || trial?.providerSubscriptionId || null,
      isSimulation: Boolean(subscription?.isSimulation),
      isTrial: trialActive,
      trialEndsAt: trialActive ? trial.endsAt : null,
      trialTargetPlan: trial?.targetPlan ? this.normalizePlan(trial.targetPlan) : null,
      hasPaidSubscription: Boolean(subscription),
      advertisingEligible: !trialActive && basePlan === 'ELITE',
      jobHighlightEligible: !trialActive && basePlan === 'ELITE',
    };
  }

  async getForUser(userId: string) {
    const company = await this.managedCompany(userId);
    const [current, trialRecord, plusProduct, eliteProduct] = await Promise.all([
      this.getCompanyPlan(company.id),
      this.trialForCompany(company.id),
      this.payments.findProduct('COMPANY_PLUS_MONTHLY', true).catch(() => null),
      this.payments.findProduct('COMPANY_ELITE_MONTHLY', true).catch(() => null),
    ]);
    const planProducts = new Map<CompanyPlan, any>([['PLUS', plusProduct], ['ELITE', eliteProduct]]);
    const trialUsed = Boolean(trialRecord);
    const trialEligibleOnSubscription = !trialUsed && !current.hasPaidSubscription;
    return {
      company: { id: company.id, name: company.name },
      current,
      trial: {
        days: ELITE_TRIAL_DAYS,
        active: current.isTrial,
        eligibleOnSubscription: trialEligibleOnSubscription,
        used: trialUsed,
        targetPlan: trialRecord?.targetPlan || null,
        startedAt: trialRecord?.startedAt || null,
        endsAt: trialRecord?.endsAt || null,
        restrictions: [
          'O teste só é concedido ao concluir a assinatura Plus ou Elite',
          'Sem elegibilidade para destaques na Meta e Google durante o período gratuito',
          'Sem destaque ou impulsionamento de vagas durante o período gratuito',
          'As funções do painel web da empresa não são limitadas por estes planos',
        ],
      },
      plans: COMPANY_PLAN_CATALOG.map((plan) => {
        const product = plan.id === 'FREE' ? null : planProducts.get(plan.id);
        return {
          ...plan,
          priceCents: plan.id === 'FREE' ? 0 : Number(product?.priceCents ?? plan.priceCents ?? 0),
          originalPriceCents: plan.id === 'FREE' ? 0 : Number(product?.originalPriceCents ?? product?.priceCents ?? plan.priceCents ?? 0),
          effectivePriceCents: plan.id === 'FREE' ? 0 : Number(product?.effectivePriceCents ?? product?.priceCents ?? plan.priceCents ?? 0),
          promotionalPriceCents: plan.id === 'FREE' ? null : product?.promotionalPriceCents ?? null,
          promotionActive: plan.id === 'FREE' ? false : Boolean(product?.promotionActive),
          current: !current.isTrial && current.basePlan === plan.id,
          available: RANK[plan.id] >= RANK[current.basePlan] || plan.id === current.basePlan,
          includesEliteTrial: plan.id !== 'FREE' && trialEligibleOnSubscription,
          eliteTrialDays: plan.id !== 'FREE' && trialEligibleOnSubscription ? ELITE_TRIAL_DAYS : 0,
        };
      }),
    };
  }

  requiredWhatsAppPlan(feature: CompanyWhatsAppFeature) {
    return WHATSAPP_FEATURE_PLAN[feature];
  }

  async hasWhatsAppFeature(companyId: string, feature: CompanyWhatsAppFeature) {
    const current = await this.getCompanyPlan(companyId);
    return RANK[current.plan] >= RANK[WHATSAPP_FEATURE_PLAN[feature]];
  }

  async assertWhatsAppFeature(companyId: string, feature: CompanyWhatsAppFeature) {
    const current = await this.getCompanyPlan(companyId);
    const requiredPlan = WHATSAPP_FEATURE_PLAN[feature];
    if (RANK[current.plan] < RANK[requiredPlan]) {
      throw new ForbiddenException({
        code: 'COMPANY_WHATSAPP_PLAN_REQUIRED',
        message: `Este comando pelo WhatsApp exige o plano ${requiredPlan}.`,
        feature,
        currentPlan: current.plan,
        requiredPlan,
        scope: 'WHATSAPP_ONLY',
        upgradeUrl: 'https://piranegocios.com.br/company/planos',
      });
    }
    return current;
  }

  async createCheckout(
    userId: string,
    requestedPlan: unknown,
    payer: PaymentCheckoutPayer = {},
  ) {
    const plan = this.normalizePlan(requestedPlan);
    if (plan === 'FREE') {
      throw new BadRequestException('O plano Free não precisa de checkout.');
    }
    const company = await this.managedCompany(userId);
    const [current, trialRecord] = await Promise.all([
      this.getCompanyPlan(company.id),
      this.trialForCompany(company.id),
    ]);
    if (!current.isTrial && current.basePlan === plan && current.hasPaidSubscription) {
      throw new BadRequestException(`A empresa já possui o plano ${plan} ativo.`);
    }

    const trialDays = !trialRecord && !current.hasPaidSubscription ? ELITE_TRIAL_DAYS : 0;
    const productCode = plan === 'ELITE' ? 'COMPANY_ELITE_MONTHLY' : 'COMPANY_PLUS_MONTHLY';
    const payment = await this.payments.createPixPayment(userId, productCode);
    const paymentMetadata = {
      companyId: company.id,
      companyPlan: plan,
      companyName: company.name,
      companyWhatsAppPlan: true,
      companyEliteTrialDays: trialDays,
      companyEliteTrialPending: trialDays > 0,
    };

    await this.dataSource.query(
      `UPDATE payments SET metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb, "updatedAt" = now()
       WHERE id = $1`,
      [payment.id, JSON.stringify(paymentMetadata)],
    );
    payment.metadata = { ...(payment.metadata || {}), ...paymentMetadata };

    const devMode = await this.payments.getDevMode();
    if (devMode.enabled) {
      if (trialDays > 0) {
        await this.payments.activateCompanyPlanTrial(payment.id, {
          provider: 'DEV',
          providerSubscriptionId: `dev-${payment.id}`,
        });
        return {
          ...payment,
          product: payment.product,
          plan,
          trialDays,
          paymentRequired: false,
          checkoutReady: false,
          providerConfigured: false,
          devSimulation: true,
          trialActivated: true,
          message: `Modo DEV: assinatura ${plan} autorizada e Elite gratuito ativado por ${trialDays} dias para ${company.name}.`,
        };
      }
      const settled = await this.payments.simulatePayment(payment.id, userId);
      return {
        ...payment,
        ...settled,
        product: payment.product,
        plan,
        trialDays: 0,
        paymentRequired: false,
        checkoutReady: false,
        providerConfigured: false,
        devSimulation: true,
        message: `Modo DEV: plano ${plan} ativado para ${company.name}.`,
      };
    }

    try {
      const checkout = await this.providers.createCheckout(
        payment,
        payer || {},
        { trialDays },
      );
      const stored = await this.payments.attachProviderCheckout(payment.id, checkout);
      const metadata = stored.metadata as any;
      return {
        ...stored,
        product: payment.product,
        plan,
        trialDays,
        company: { id: company.id, name: company.name },
        checkoutReady: Boolean(
          stored.pixCopyPaste ||
            stored.qrCodeBase64 ||
            metadata?.ticketUrl ||
            metadata?.subscriptionCheckoutUrl,
        ),
        providerConfigured: true,
        paymentRequired: true,
        trialStartsAfterAuthorization: trialDays > 0,
      };
    } catch (error) {
      await this.payments.cancelProviderCheckout(payment.id, error).catch(() => undefined);
      throw error;
    }
  }

  async latestCheckout(userId: string) {
    const company = await this.managedCompany(userId);
    const rows = await this.dataSource.query(
      `SELECT p.*, pp.name AS "productName"
       FROM payments p
       LEFT JOIN payment_products pp ON pp.code = p."productCode"
       WHERE p."userId" = $1
         AND p."productCode" IN ('COMPANY_PLUS_MONTHLY','COMPANY_ELITE_MONTHLY')
         AND p.metadata->>'companyId' = $2
       ORDER BY p."createdAt" DESC
       LIMIT 1`,
      [userId, company.id],
    );
    return rows[0] || null;
  }

  async setCancelAtPeriodEnd(userId: string, enabled: boolean) {
    const company = await this.managedCompany(userId);
    const rows = await this.dataSource.query(
      `UPDATE company_plan_subscriptions
       SET "cancelAtPeriodEnd" = $2, "updatedAt" = now()
       WHERE "companyId" = $1 AND status IN ('ACTIVE','PAST_DUE')
       RETURNING *`,
      [company.id, enabled],
    );
    if (!rows[0]) throw new NotFoundException('A empresa não possui uma assinatura paga ativa.');
    return rows[0];
  }
}
