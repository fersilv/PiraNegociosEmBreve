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
  | 'AD_HIGHLIGHTS';

const RANK: Record<CompanyPlan, number> = { FREE: 0, PLUS: 1, ELITE: 2 };

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
    description: 'Gestão completa do recrutamento pelo WhatsApp e participação nos destaques publicitários.',
    features: [
      'Tudo dos planos Free e Plus',
      'Mudar status da candidatura',
      'Adicionar observações internas',
      'Convidar e remover convite de candidato',
      'Adicionar e remover candidatos do Banco de Talentos e pastas',
      'Responder e gerenciar candidatos pelo WhatsApp',
      'Consultar novas candidaturas por período',
      'Estatísticas avançadas das vagas',
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

  async getCompanyPlan(companyId: string) {
    await this.dataSource.query(
      `UPDATE company_plan_subscriptions
       SET status = 'EXPIRED', "updatedAt" = now()
       WHERE "companyId" = $1 AND status IN ('ACTIVE','PAST_DUE') AND "currentPeriodEnd" <= now()`,
      [companyId],
    ).catch(() => undefined);

    const rows = await this.dataSource.query(
      `SELECT * FROM company_plan_subscriptions
       WHERE "companyId" = $1 AND status IN ('ACTIVE','PAST_DUE') AND "currentPeriodEnd" > now()
       LIMIT 1`,
      [companyId],
    );
    const subscription = rows[0] || null;
    const plan = subscription ? this.normalizePlan(subscription.plan) : 'FREE';
    return {
      plan,
      rank: RANK[plan],
      active: plan !== 'FREE',
      status: subscription?.status || 'FREE',
      currentPeriodStart: subscription?.currentPeriodStart || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
      provider: subscription?.provider || null,
      isSimulation: Boolean(subscription?.isSimulation),
      advertisingEligible: plan === 'ELITE',
    };
  }

  async getForUser(userId: string) {
    const company = await this.managedCompany(userId);
    const current = await this.getCompanyPlan(company.id);
    return {
      company: { id: company.id, name: company.name },
      current,
      plans: COMPANY_PLAN_CATALOG.map((plan) => ({
        ...plan,
        current: current.plan === plan.id,
        available: RANK[plan.id] >= RANK[current.plan] || plan.id === current.plan,
      })),
    };
  }

  requiredPlan(feature: CompanyPlanFeature) {
    return FEATURE_PLAN[feature];
  }

  async hasFeature(companyId: string, feature: CompanyPlanFeature) {
    const current = await this.getCompanyPlan(companyId);
    return RANK[current.plan] >= RANK[FEATURE_PLAN[feature]];
  }

  async assertFeature(companyId: string, feature: CompanyPlanFeature) {
    const current = await this.getCompanyPlan(companyId);
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
    if (current.plan === plan && current.active) {
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
    if (!rows[0]) throw new NotFoundException('A empresa não possui uma assinatura ativa.');
    return rows[0];
  }
}
