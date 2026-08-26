import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type PaymentProductCode =
  | 'RESUME_REANALYSIS'
  | 'RESUME_AI_IMPROVEMENT'
  | 'RESUME_AI_IMPORT';

export type FeatureCredit =
  | 'RESUME_REANALYSIS'
  | 'RESUME_AI_IMPROVEMENT'
  | 'RESUME_AI_IMPORT';

@Injectable()
export class PaymentsService {
  constructor(private readonly dataSource: DataSource) {}

  private currentPromoPrice(product: any): number | null {
    const value = product?.promotionalPriceCents;
    if (value === null || value === undefined) return null;
    const now = Date.now();
    const startsAt = product?.promotionStartsAt
      ? new Date(product.promotionStartsAt).getTime()
      : Number.NEGATIVE_INFINITY;
    const endsAt = product?.promotionEndsAt
      ? new Date(product.promotionEndsAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return null;
    return now >= startsAt && now <= endsAt ? Number(value) : null;
  }

  private presentProduct(product: any) {
    const promo = this.currentPromoPrice(product);
    const originalPriceCents = Number(product.priceCents || 0);
    const effectivePriceCents = promo ?? originalPriceCents;
    return {
      ...product,
      originalPriceCents,
      effectivePriceCents,
      promotionActive: promo !== null,
      discountCents: Math.max(0, originalPriceCents - effectivePriceCents),
    };
  }

  async listCatalog(includeDisabled = false) {
    const rows = await this.dataSource.query(
      `SELECT * FROM payment_products ${includeDisabled ? '' : 'WHERE enabled = true'} ORDER BY "sortOrder" ASC, name ASC`,
    );
    return rows.map((row: any) => this.presentProduct(row));
  }

  async findProduct(code: string, includeDisabled = false) {
    const rows = await this.dataSource.query(
      `SELECT * FROM payment_products WHERE code = $1 ${includeDisabled ? '' : 'AND enabled = true'} LIMIT 1`,
      [code],
    );
    if (!rows[0]) throw new NotFoundException('Produto não encontrado ou indisponível.');
    return this.presentProduct(rows[0]);
  }

  async updateProduct(code: string, input: Record<string, unknown>) {
    const current = await this.findProduct(code, true);
    const priceCents = input.priceCents === undefined
      ? Number(current.priceCents)
      : Math.max(0, Math.round(Number(input.priceCents) || 0));
    const promotionalPriceCents = input.promotionalPriceCents === undefined
      ? current.promotionalPriceCents
      : input.promotionalPriceCents === null || input.promotionalPriceCents === ''
        ? null
        : Math.max(0, Math.round(Number(input.promotionalPriceCents) || 0));
    const freeUses = input.freeUses === undefined
      ? Number(current.freeUses || 0)
      : Math.max(0, Math.round(Number(input.freeUses) || 0));
    const enabled = input.enabled === undefined ? Boolean(current.enabled) : input.enabled === true;
    const name = input.name === undefined ? current.name : String(input.name || '').trim().slice(0, 120);
    const description = input.description === undefined ? current.description : String(input.description || '').trim().slice(0, 2000);
    const promotionStartsAt = input.promotionStartsAt === undefined ? current.promotionStartsAt : input.promotionStartsAt || null;
    const promotionEndsAt = input.promotionEndsAt === undefined ? current.promotionEndsAt : input.promotionEndsAt || null;

    if (!name) throw new BadRequestException('O produto precisa ter um nome.');
    if (promotionalPriceCents !== null && promotionalPriceCents > priceCents) {
      throw new BadRequestException('O preço promocional não pode ser maior que o preço normal.');
    }
    if (promotionStartsAt && promotionEndsAt && new Date(String(promotionEndsAt)).getTime() < new Date(String(promotionStartsAt)).getTime()) {
      throw new BadRequestException('O fim da promoção não pode ser anterior ao início.');
    }

    const rows = await this.dataSource.query(
      `UPDATE payment_products
       SET name = $2, description = $3, "priceCents" = $4, "promotionalPriceCents" = $5,
           "promotionStartsAt" = $6, "promotionEndsAt" = $7, enabled = $8, "freeUses" = $9, "updatedAt" = now()
       WHERE code = $1
       RETURNING *`,
      [code, name, description, priceCents, promotionalPriceCents, promotionStartsAt, promotionEndsAt, enabled, freeUses],
    );
    return this.presentProduct(rows[0]);
  }

  async getDevMode() {
    const rows = await this.dataSource.query(
      `SELECT value FROM settings WHERE key = 'PAYMENTS_DEV_MODE' LIMIT 1`,
    );
    return { enabled: String(rows[0]?.value || 'false') === 'true' };
  }

  async setDevMode(enabled: boolean) {
    await this.dataSource.query(
      `INSERT INTO settings (key, value, description, "isPublic")
       VALUES ('PAYMENTS_DEV_MODE', $1, 'Permite simular aprovação de pagamentos Pix no painel administrativo.', false)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, description = EXCLUDED.description, "isPublic" = false, "updatedAt" = now()`,
      [enabled ? 'true' : 'false'],
    );
    return { enabled };
  }

  async productPerformance() {
    const rows = await this.dataSource.query(`
      SELECT
        pp.code,
        pp.name,
        pp.enabled,
        pp."billingType",
        pp."priceCents",
        pp."promotionalPriceCents",
        count(p.id) FILTER (WHERE p."isSimulation" = false)::int AS checkouts,
        count(p.id) FILTER (WHERE p.status = 'PAID' AND p."isSimulation" = false)::int AS sales,
        count(DISTINCT p."userId") FILTER (WHERE p.status = 'PAID' AND p."isSimulation" = false)::int AS buyers,
        coalesce(sum(p."amountCents") FILTER (WHERE p.status = 'PAID' AND p."isSimulation" = false), 0)::int AS revenue,
        count(p.id) FILTER (WHERE p.status = 'PENDING' AND p."isSimulation" = false)::int AS pending,
        count(p.id) FILTER (WHERE p.status IN ('EXPIRED','CANCELED') AND p."isSimulation" = false)::int AS abandoned
      FROM payment_products pp
      LEFT JOIN payments p ON p."productCode" = pp.code
      GROUP BY pp.code, pp.name, pp.enabled, pp."billingType", pp."priceCents", pp."promotionalPriceCents", pp."sortOrder"
      ORDER BY pp."sortOrder" ASC, pp.name ASC
    `);
    const totalSales = rows.reduce((sum: number, row: any) => sum + Number(row.sales || 0), 0);
    const products = rows.map((row: any) => {
      const checkouts = Number(row.checkouts || 0);
      const sales = Number(row.sales || 0);
      return {
        ...row,
        checkouts,
        sales,
        buyers: Number(row.buyers || 0),
        revenue: Number(row.revenue || 0),
        pending: Number(row.pending || 0),
        abandoned: Number(row.abandoned || 0),
        conversionPercent: checkouts > 0 ? Math.round((sales / checkouts) * 1000) / 10 : 0,
        salesSharePercent: totalSales > 0 ? Math.round((sales / totalSales) * 1000) / 10 : 0,
      };
    });
    const bySales = [...products].sort((a, b) => b.sales - a.sales || b.revenue - a.revenue);
    const byRevenue = [...products].sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);
    const conversionPool = products.some((item: any) => item.checkouts >= 3)
      ? products.filter((item: any) => item.checkouts >= 3)
      : products.filter((item: any) => item.checkouts > 0);
    const byConversion = [...conversionPool].sort((a, b) => b.conversionPercent - a.conversionPercent || b.sales - a.sales);
    return {
      products,
      highlights: {
        topSelling: bySales[0] || null,
        topRevenue: byRevenue[0] || null,
        topConversion: byConversion[0] || null,
      },
    };
  }

  async createPixPayment(userId: string, productCode: string) {
    const product = await this.findProduct(productCode, false);
    const amountCents = Number(product.effectivePriceCents || 0);
    if (amountCents <= 0) {
      throw new BadRequestException('Este recurso não exige pagamento no momento.');
    }

    const rows = await this.dataSource.query(
      `INSERT INTO payments
        ("userId", "productCode", method, status, "originalAmountCents", "amountCents", "discountCents", provider, metadata)
       VALUES ($1, $2, 'PIX', 'PENDING', $3, $4, $5, NULL, $6::jsonb)
       RETURNING *`,
      [
        userId,
        product.code,
        Number(product.originalPriceCents || amountCents),
        amountCents,
        Number(product.discountCents || 0),
        JSON.stringify({ promotionActive: Boolean(product.promotionActive) }),
      ],
    );

    return {
      ...rows[0],
      product,
      checkoutReady: false,
      providerConfigured: false,
    };
  }

  async attachProviderCheckout(
    paymentId: string,
    checkout: {
      provider: string;
      providerPaymentId: string;
      pixCopyPaste?: string | null;
      qrCodeBase64?: string | null;
      expiresAt?: Date | string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const rows = await this.dataSource.query(
      `UPDATE payments SET
         provider = $2,
         "providerPaymentId" = $3,
         "pixCopyPaste" = $4,
         "qrCodeBase64" = $5,
         "expiresAt" = $6,
         metadata = coalesce(metadata,'{}'::jsonb) || $7::jsonb,
         "updatedAt" = now()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *`,
      [
        paymentId,
        String(checkout.provider || '').toUpperCase(),
        checkout.providerPaymentId,
        checkout.pixCopyPaste || null,
        checkout.qrCodeBase64 || null,
        checkout.expiresAt || null,
        JSON.stringify(checkout.metadata || {}),
      ],
    );
    if (!rows[0]) throw new NotFoundException('Pagamento pendente não encontrado.');
    return rows[0];
  }

  async cancelProviderCheckout(paymentId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Falha ao criar cobrança no provedor');
    const rows = await this.dataSource.query(
      `UPDATE payments SET status = 'CANCELED', "canceledAt" = now(), "updatedAt" = now(),
         metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb
       WHERE id = $1 AND status = 'PENDING' RETURNING *`,
      [paymentId, JSON.stringify({ providerCheckoutError: message.slice(0, 1000) })],
    );
    return rows[0] || null;
  }

  async listUserPayments(userId: string) {
    return this.dataSource.query(
      `SELECT p.*, pp.name AS "productName", pp.description AS "productDescription"
       FROM payments p
       LEFT JOIN payment_products pp ON pp.code = p."productCode"
       WHERE p."userId" = $1
       ORDER BY p."createdAt" DESC`,
      [userId],
    );
  }

  async listAllPayments(limit = 200) {
    const safeLimit = Math.min(500, Math.max(1, Math.round(limit)));
    return this.dataSource.query(
      `SELECT p.*, pp.name AS "productName", u.email, u."fullName", u."displayName"
       FROM payments p
       LEFT JOIN payment_products pp ON pp.code = p."productCode"
       LEFT JOIN users u ON u.id = p."userId"
       ORDER BY p."createdAt" DESC
       LIMIT ${safeLimit}`,
    );
  }

  async paymentSummary() {
    const rows = await this.dataSource.query(`
      SELECT
        count(*) FILTER (WHERE "isSimulation" = false)::int AS total,
        count(*) FILTER (WHERE status = 'PENDING' AND "isSimulation" = false)::int AS pending,
        count(*) FILTER (WHERE status = 'PAID' AND "isSimulation" = false)::int AS paid,
        count(*) FILTER (WHERE status = 'PAID' AND "isSimulation" = true)::int AS simulated,
        coalesce(sum("amountCents") FILTER (WHERE status = 'PAID' AND "isSimulation" = false), 0)::int AS "paidAmountCents"
      FROM payments
    `);
    return rows[0] || { total: 0, pending: 0, paid: 0, simulated: 0, paidAmountCents: 0 };
  }

  private featureForProduct(code: string): FeatureCredit | null {
    if (code === 'RESUME_REANALYSIS') return 'RESUME_REANALYSIS';
    if (code === 'RESUME_AI_IMPROVEMENT') return 'RESUME_AI_IMPROVEMENT';
    if (code === 'RESUME_AI_IMPORT') return 'RESUME_AI_IMPORT';
    return null;
  }

  private async settlePayment(
    paymentId: string,
    metadata: Record<string, unknown>,
    isSimulation: boolean,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
        [paymentId],
      );
      const payment = rows[0];
      if (!payment) throw new NotFoundException('Pagamento não encontrado.');
      if (payment.status === 'PAID') return payment;
      if (payment.status !== 'PENDING') {
        throw new BadRequestException(`Pagamento não pode ser confirmado no status ${payment.status}.`);
      }

      const paidRows = await manager.query(
        `UPDATE payments
         SET status = 'PAID', "paidAt" = now(), "updatedAt" = now(), "isSimulation" = $3,
             metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
         WHERE id = $1 RETURNING *`,
        [paymentId, JSON.stringify(metadata), isSimulation],
      );

      const feature = this.featureForProduct(payment.productCode);
      if (feature) {
        await manager.query(
          `INSERT INTO user_feature_credits ("userId", feature, credits)
           VALUES ($1, $2, 1)
           ON CONFLICT ("userId", feature)
           DO UPDATE SET credits = user_feature_credits.credits + 1, "updatedAt" = now()`,
          [payment.userId, feature],
        );
      }

      return paidRows[0];
    });
  }

  async activateCompanyPlanTrial(
    paymentId: string,
    input: { provider?: string; providerSubscriptionId?: string | null } = {},
  ) {
    const rows = await this.dataSource.query(`SELECT * FROM payments WHERE id = $1 LIMIT 1`, [paymentId]);
    const payment = rows[0];
    if (!payment) throw new NotFoundException('Pagamento da assinatura não encontrado.');
    if (!['COMPANY_PLUS_MONTHLY', 'COMPANY_ELITE_MONTHLY'].includes(String(payment.productCode))) return null;
    const metadata = typeof payment.metadata === 'object' && payment.metadata
      ? payment.metadata
      : (() => { try { return JSON.parse(String(payment.metadata || '{}')); } catch { return {}; } })();
    const companyId = String(metadata.companyId || '').trim();
    const trialDays = Math.max(0, Math.min(30, Math.round(Number(metadata.companyEliteTrialDays || 0))));
    const targetPlan = String(metadata.companyPlan || '').toUpperCase() === 'ELITE' ? 'ELITE' : 'PLUS';
    if (!companyId || trialDays <= 0) return null;

    const inserted = await this.dataSource.query(
      `INSERT INTO company_plan_trials
        ("companyId", "startedBy", "targetPlan", status, "startedAt", "endsAt", provider,
         "providerSubscriptionId", "paymentId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ACTIVE', now(), now() + make_interval(days => $4::int), $5, $6, $7, now(), now())
       ON CONFLICT ("companyId") DO NOTHING RETURNING *`,
      [companyId, payment.userId, targetPlan, trialDays, String(input.provider || payment.provider || '') || null, input.providerSubscriptionId || null, payment.id],
    );
    const trial = inserted[0] || (await this.dataSource.query(
      `SELECT * FROM company_plan_trials WHERE "companyId" = $1 LIMIT 1`, [companyId],
    ))[0] || null;
    if (trial?.status === 'ACTIVE') {
      await this.dataSource.query(
        `INSERT INTO company_ad_highlight_eligibility
          ("companyId", eligible, channels, "eligibleUntil", source, "updatedAt")
         VALUES ($1, false, '["META","GOOGLE"]'::jsonb, NULL, 'ELITE_TRIAL', now())
         ON CONFLICT ("companyId") DO UPDATE SET eligible = false, "eligibleUntil" = NULL, source = 'ELITE_TRIAL', "updatedAt" = now()`,
        [companyId],
      ).catch(() => undefined);
      await this.dataSource.query(
        `UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`,
        [payment.id, JSON.stringify({ companyEliteTrialPending: false, companyEliteTrialActivated: true, companyEliteTrialStartedAt: trial.startedAt, companyEliteTrialEndsAt: trial.endsAt })],
      );
    }
    return trial;
  }

  async confirmPayment(paymentId: string, metadata: Record<string, unknown> = {}) {
    return this.settlePayment(paymentId, metadata, false);
  }

  async confirmProviderPayment(paymentId: string, metadata: Record<string, unknown> = {}) {
    return this.settlePayment(paymentId, metadata, false);
  }

  async simulatePayment(paymentId: string, adminUserId: string) {
    const devMode = await this.getDevMode();
    if (!devMode.enabled) {
      throw new BadRequestException('O modo DEV de pagamentos está desativado. Ative-o no painel financeiro para usar simulações.');
    }
    return this.settlePayment(
      paymentId,
      {
        simulatedByAdmin: adminUserId,
        confirmationMode: 'DEV_SIMULATION',
        simulatedAt: new Date().toISOString(),
      },
      true,
    );
  }

  async getCredits(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT feature, credits FROM user_feature_credits WHERE "userId" = $1`,
      [userId],
    );
    const credits: Record<string, number> = {
      RESUME_REANALYSIS: 0,
      RESUME_AI_IMPROVEMENT: 0,
      RESUME_AI_IMPORT: 0,
    };
    for (const row of rows) credits[row.feature] = Number(row.credits || 0);
    return credits;
  }

  async hasCredit(userId: string, feature: FeatureCredit) {
    const rows = await this.dataSource.query(
      `SELECT credits FROM user_feature_credits WHERE "userId" = $1 AND feature = $2 LIMIT 1`,
      [userId, feature],
    );
    return Number(rows[0]?.credits || 0) > 0;
  }

  async consumeCredit(userId: string, feature: FeatureCredit) {
    const rows = await this.dataSource.query(
      `UPDATE user_feature_credits
       SET credits = credits - 1, "updatedAt" = now()
       WHERE "userId" = $1 AND feature = $2 AND credits > 0
       RETURNING credits`,
      [userId, feature],
    );
    if (!rows[0]) throw new BadRequestException('Crédito insuficiente para este recurso.');
    return Number(rows[0].credits || 0);
  }

  async grantCredit(userId: string, feature: FeatureCredit, quantity = 1) {
    const safeQuantity = Math.min(100, Math.max(1, Math.round(quantity)));
    await this.dataSource.query(
      `INSERT INTO user_feature_credits ("userId", feature, credits)
       VALUES ($1, $2, $3)
       ON CONFLICT ("userId", feature)
       DO UPDATE SET credits = user_feature_credits.credits + $3, "updatedAt" = now()`,
      [userId, feature, safeQuantity],
    );
    return this.getCredits(userId);
  }

  private resumeSnapshot(profile: any) {
    return {
      fullName: profile?.fullName || '',
      socialName: profile?.socialName || '',
      bio: profile?.bio || '',
      experiences: Array.isArray(profile?.experiences) ? profile.experiences : [],
      education: Array.isArray(profile?.education) ? profile.education : [],
      skills: Array.isArray(profile?.skills) ? profile.skills : [],
      courses: Array.isArray(profile?.courses) ? profile.courses : [],
      languages: Array.isArray(profile?.languages) ? profile.languages : [],
      resumePreferences: profile?.resumePreferences || {},
    };
  }

  async recordAnalysis(
    userId: string,
    profile: any,
    analysis: Record<string, unknown>,
    source: 'FREE' | 'REANALYSIS' | 'IMPROVEMENT',
    paymentId?: string | null,
  ) {
    const score = Math.max(0, Math.min(100, Math.round(Number(analysis?.score) || 0)));
    const rows = await this.dataSource.query(
      `INSERT INTO resume_analysis_history
        ("userId", source, score, analysis, "resumeSnapshot", "paymentId")
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
       RETURNING *`,
      [userId, source, score, JSON.stringify(analysis), JSON.stringify(this.resumeSnapshot(profile)), paymentId || null],
    );
    return rows[0];
  }

  async listAnalysisHistory(userId: string) {
    return this.dataSource.query(
      `SELECT id, source, score, analysis, "createdAt" FROM resume_analysis_history
       WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId],
    );
  }

  async createImprovementProposal(userId: string, profile: any, proposal: Record<string, unknown>, paymentId?: string | null) {
    const rows = await this.dataSource.query(
      `INSERT INTO resume_improvement_proposals
        ("userId", "beforeSnapshot", proposal, "paymentId")
       VALUES ($1, $2::jsonb, $3::jsonb, $4)
       RETURNING *`,
      [userId, JSON.stringify(this.resumeSnapshot(profile)), JSON.stringify(proposal), paymentId || null],
    );
    return rows[0];
  }

  async getImprovementProposal(userId: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM resume_improvement_proposals WHERE id = $1 AND "userId" = $2 LIMIT 1`,
      [id, userId],
    );
    if (!rows[0]) throw new NotFoundException('Proposta de melhoria não encontrada.');
    return rows[0];
  }

  async completeImprovementProposal(userId: string, id: string, selectedChangeIds: string[], partial: boolean) {
    const rows = await this.dataSource.query(
      `UPDATE resume_improvement_proposals
       SET status = $3, "selectedChangeIds" = $4::jsonb, "appliedAt" = now(), "updatedAt" = now()
       WHERE id = $1 AND "userId" = $2
       RETURNING *`,
      [id, userId, partial ? 'PARTIAL' : 'APPLIED', JSON.stringify(selectedChangeIds)],
    );
    if (!rows[0]) throw new NotFoundException('Proposta de melhoria não encontrada.');
    return rows[0];
  }

  async listImprovementHistory(userId: string) {
    return this.dataSource.query(
      `SELECT id, status, proposal, "selectedChangeIds", "appliedAt", "createdAt"
       FROM resume_improvement_proposals WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId],
    );
  }

  async listPublicationHistory(userId: string) {
    return this.dataSource.query(
      `SELECT id, version, snapshot, score, status, "publishedAt", "unpublishedAt"
       FROM resume_publication_history WHERE "userId" = $1 ORDER BY version DESC`,
      [userId],
    );
  }
}
