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
export type CompanyPlanFeature =
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
  | 'ADVANCED_JOB_STATS'
  | 'JOB_HIGHLIGHT'
  | 'AD_HIGHLIGHTS';

const RANK: Record<CompanyPlan, number> = { FREE: 0, PLUS: 1, ELITE: 2 };
const ELITE_TRIAL_DAYS = 15;
const TRIAL_BLOCKED_FEATURES = new Set<CompanyPlanFeature>(['JOB_HIGHLIGHT', 'AD_HIGHLIGHTS']);

export const COMPANY_PLAN_CATALOG = [
  {
    id: 'FREE' as const,
    name: 'Free',
    priceCents: 0,
    monthly: false,
    description: 'O essencial para recrutar e conversar com a assistente pelo WhatsApp.',
    features: [
      'Listar vagas da empresa',
      'Consultar quantidade de candidaturas por vaga',
      'Consultar candidatos compatíveis',
      'Criar vagas pelo WhatsApp',
      'Editar vagas pelo WhatsApp',
    ],
  },
  {
    id: 'PLUS' as const,
    name: 'Plus',
    priceCents: 1990,
    monthly: true,
    productCode: 'COMPANY_PLUS_MONTHLY',
    description: 'Controle operacional das vagas e visão detalhada dos candidatos pelo WhatsApp.',
    features: [
      'Tudo do plano Free',
      'Ativar vaga',
      'Desativar vaga',
      'Encerrar vaga',
      'Listar candidatos individualmente com detalhes',
      'Abrir perfil e currículo de candidato',
    ],
  },
  {
    id: 'ELITE' as const,
    name: 'Elite',
    priceCents: 4990,
    monthly: true,
    productCode: 'COMPANY_ELITE_MONTHLY',
    description: 'Gestão completa do recrutamento pelo WhatsApp e benefícios promocionais exclusivos do plano pago.',
    features: [
      'Tudo dos planos Free e Plus',
      'Mudar status da candidatura',
      'Adicionar observações internas',
      'Convidar e remover convite de candidato',
      'Adicionar e remover candidatos do Banco de Talentos e pastas',
      'Responder e gerenciar candidatos pelo WhatsApp',
      'Consultar novas candidaturas por período',
      'Estatísticas avançadas das vagas',
      'Elegibilidade para destaque das vagas no PiraNegócios',
      'Elegibilidade aos destaques de anúncios do PiraNegócios na Meta e Google',
    ],
  },
] as const;

const FEATURE_PLAN: Record<CompanyPlanFeature, CompanyPlan> = {
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
  JOB_HIGHLIGHT: 'ELITE',
  AD_HIGHLIGHTS: 'ELITE',
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
       JOIN companies c ON c.id = u."companyId" OR c."ownerId" = u.id
       WHERE u.id = $1
         AND (c."ownerId" = u.id OR u."isCompanyAdmin" = true OR u.type = 'ADMIN')
       ORDER BY CASE WHEN c.id = u."companyId" THEN 0 ELSE 1 END, c."createdAt" ASC
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
      basePlan !== 'ELITE' &&
      trial?.status === 'ACTIVE' &&
      new Date(trial.endsAt).getTime() > Date.now(),
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
      provider: subscription?.provider || null,
      isSimulation: Boolean(subscription?.isSimulation),
      isTrial: trialActive,
      trialEndsAt: trialActive ? trial.endsAt : null,
      hasPaidSubscription: Boolean(subscription),
      advertisingEligible: !trialActive && basePlan === 'ELITE',
      jobHighlightEligible: !trialActive && basePlan === 'ELITE',
    };
  }

  async getForUser(userId: string) {
    const company = await this.managedCompany(userId);
    const [current, trialRecord] = await Promise.all([
      this.getCompanyPlan(company.id),
      this.trialForCompany(company.id),
    ]);
    const trialUsed = Boolean(trialRecord);
    const trialEligible = !trialUsed && !(current.basePlan === 'ELITE' && current.hasPaidSubscription);
    return {
      company: { id: company.id, name: company.name },
      current,
      trial: {
        days: ELITE_TRIAL_DAYS,
        active: current.isTrial,
        eligible: trialEligible,
        used: trialUsed,
        startedAt: trialRecord?.startedAt || null,
        endsAt: trialRecord?.endsAt || null,
        restrictions: [
          'Sem elegibilidade para destaques na Meta e Google durante o período gratuito',
          'Sem destaque ou impulsionamento de vagas durante o período gratuito',
        ],
      },
      plans: COMPANY_PLAN_CATALOG.map((plan) => ({
        ...plan,
        current: !current.isTrial && current.basePlan === plan.id,
        available: RANK[plan.id] >= RANK[current.basePlan] || plan.id === current.basePlan,
        trialEligible: plan.id !== 'FREE' && trialEligible,
      })),
    };
  }

  requiredPlan(feature: CompanyPlanFeature) {
    return FEATURE_PLAN[feature];
  }

  async hasFeature(companyId: string, feature: CompanyPlanFeature) {
    const current = await this.getCompanyPlan(companyId);
    if (current.isTrial && TRIAL_BLOCKED_FEATURES.has(feature)) return false;
    return RANK[current.plan] >= RANK[FEATURE_PLAN[feature]];
  }

  async assertFeature(companyId: string, feature: CompanyPlanFeature) {
    const current = await this.getCompanyPlan(companyId);
    if (current.isTrial && TRIAL_BLOCKED_FEATURES.has(feature)) {
      throw new ForbiddenException({
        code: 'COMPANY_TRIAL_RESTRICTED',
        message: feature === 'AD_HIGHLIGHTS'
          ? 'O período gratuito do Elite não inclui elegibilidade para destaques na Meta e Google.'
          : 'O período gratuito do Elite não inclui destaque ou impulsionamento de vagas.',
        feature,
        currentPlan: 'ELITE',
        isTrial: true,
        trialEndsAt: current.trialEndsAt,
        paidEliteUrl: 'https://piranegocios.com.br/company/planos',
      });
    }
    const requiredPlan = FEATURE_PLAN[feature];
    if (RANK[current.plan] < RANK[requiredPlan]) {
      throw new ForbiddenException({
        code: 'COMPANY_PLAN_REQUIRED',
        message: `Este recurso exige o plano ${requiredPlan}.`,
        feature,
        currentPlan: current.plan,
        requiredPlan,
        upgradeUrl: 'https://piranegocios.com.br/company/planos',
      });
    }
    return current;
  }

  async startEliteTrial(userId: string) {
    const company = await this.managedCompany(userId);
    const current = await this.getCompanyPlan(company.id);
    if (current.isTrial) {
      throw new BadRequestException('O Elite gratuito já está ativo para esta empresa.');
    }
    if (current.basePlan === 'ELITE' && current.hasPaidSubscription) {
      throw new BadRequestException('A empresa já possui o Elite pago ativo.');
    }

    try {
      await this.dataSource.query(
        `INSERT INTO company_plan_trials
          ("companyId", "startedBy", status, "startedAt", "endsAt", "createdAt", "updatedAt")
         VALUES ($1, $2, 'ACTIVE', now(), now() + interval '15 days', now(), now())`,
        [company.id, userId],
      );
    } catch (error: any) {
      if (String(error?.code || '') === '23505') {
        throw new BadRequestException('O teste gratuito de 15 dias já foi utilizado por esta empresa.');
      }
      throw error;
    }

    await this.dataSource.query(
      `INSERT INTO company_ad_highlight_eligibility
        ("companyId", eligible, channels, "eligibleUntil", source, "updatedAt")
       VALUES ($1, false, '["META","GOOGLE"]'::jsonb, NULL, 'ELITE_TRIAL', now())
       ON CONFLICT ("companyId") DO UPDATE SET
         eligible = false,
         "eligibleUntil" = NULL,
         source = 'ELITE_TRIAL',
         "updatedAt" = now()`,
      [company.id],
    ).catch(() => undefined);

    return this.getForUser(userId);
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
    const current = await this.getCompanyPlan(company.id);
    if (!current.isTrial && current.basePlan === plan && current.hasPaidSubscription) {
      throw new BadRequestException(`A empresa já possui o plano ${plan} ativo.`);
    }

    const productCode = plan === 'ELITE' ? 'COMPANY_ELITE_MONTHLY' : 'COMPANY_PLUS_MONTHLY';
    const payment = await this.payments.createPixPayment(userId, productCode);

    await this.dataSource.query(
      `UPDATE payments SET metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb, "updatedAt" = now()
       WHERE id = $1`,
      [payment.id, JSON.stringify({ companyId: company.id, companyPlan: plan, companyName: company.name })],
    );
    payment.metadata = { ...(payment.metadata || {}), companyId: company.id, companyPlan: plan, companyName: company.name };

    const devMode = await this.payments.getDevMode();
    if (devMode.enabled) {
      const settled = await this.payments.simulatePayment(payment.id, userId);
      return {
        ...payment,
        ...settled,
        product: payment.product,
        plan,
        paymentRequired: false,
        checkoutReady: false,
        providerConfigured: false,
        devSimulation: true,
        message: `Modo DEV: plano ${plan} ativado para ${company.name}.`,
      };
    }

    try {
      const checkout = await this.providers.createCheckout(payment, payer || {});
      const stored = await this.payments.attachProviderCheckout(payment.id, checkout);
      const metadata = stored.metadata as any;
      return {
        ...stored,
        product: payment.product,
        plan,
        company: { id: company.id, name: company.name },
        checkoutReady: Boolean(
          stored.pixCopyPaste ||
            stored.qrCodeBase64 ||
            metadata?.ticketUrl ||
            metadata?.subscriptionCheckoutUrl,
        ),
        providerConfigured: true,
        paymentRequired: true,
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
