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

  async createPixPayment(userId: string, productCode: string) {
    const product = await this.findProduct(productCode, false);
    const amountCents = Number(product.effectivePriceCents || 0);
    if (amountCents <= 0) {
      throw new BadRequestException('Este recurso não exige pagamento no momento.');
    }

    const provider = String(process.env.PIX_PROVIDER || '').trim() || null;
    const rows = await this.dataSource.query(
      `INSERT INTO payments
        ("userId", "productCode", method, status, "originalAmountCents", "amountCents", "discountCents", provider, metadata)
       VALUES ($1, $2, 'PIX', 'PENDING', $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [
        userId,
        product.code,
        Number(product.originalPriceCents || amountCents),
        amountCents,
        Number(product.discountCents || 0),
        provider,
        JSON.stringify({ promotionActive: Boolean(product.promotionActive) }),
      ],
    );

    // O domínio de pagamento já é exclusivamente PIX. A geração do QR/copia-e-cola
    // entra pelo adaptador do provedor escolhido; enquanto ele não estiver configurado,
    // o registro fica PENDING e pode ser confirmado pelo admin em ambiente de teste.
    return {
      ...rows[0],
      product,
      checkoutReady: Boolean(rows[0].pixCopyPaste || rows[0].qrCodeBase64),
      providerConfigured: Boolean(provider),
    };
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
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        count(*) FILTER (WHERE status = 'PAID')::int AS paid,
        coalesce(sum("amountCents") FILTER (WHERE status = 'PAID'), 0)::int AS "paidAmountCents"
      FROM payments
    `);
    return rows[0] || { total: 0, pending: 0, paid: 0, paidAmountCents: 0 };
  }

  private featureForProduct(code: string): FeatureCredit | null {
    if (code === 'RESUME_REANALYSIS') return 'RESUME_REANALYSIS';
    if (code === 'RESUME_AI_IMPROVEMENT') return 'RESUME_AI_IMPROVEMENT';
    if (code === 'RESUME_AI_IMPORT') return 'RESUME_AI_IMPORT';
    return null;
  }

  async confirmPayment(paymentId: string, metadata: Record<string, unknown> = {}) {
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
         SET status = 'PAID', "paidAt" = now(), "updatedAt" = now(),
             metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
         WHERE id = $1 RETURNING *`,
        [paymentId, JSON.stringify(metadata)],
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

      // A otimização inclui a reanálise final prometida ao usuário.
      if (payment.productCode === 'RESUME_AI_IMPROVEMENT') {
        await manager.query(
          `INSERT INTO user_feature_credits ("userId", feature, credits)
           VALUES ($1, 'RESUME_REANALYSIS', 1)
           ON CONFLICT ("userId", feature)
           DO UPDATE SET credits = user_feature_credits.credits + 1, "updatedAt" = now()`,
          [payment.userId],
        );
      }

      return paidRows[0];
    });
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

  async recordPublication(userId: string, snapshot: Record<string, unknown>) {
    return this.dataSource.transaction(async (manager) => {
      const versionRows = await manager.query(
        `SELECT coalesce(max(version), 0)::int + 1 AS version FROM resume_publication_history WHERE "userId" = $1`,
        [userId],
      );
      const version = Number(versionRows[0]?.version || 1);
      const rawScore = Number(snapshot?.score);
      const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
      const rows = await manager.query(
        `INSERT INTO resume_publication_history ("userId", version, snapshot, score, status, "publishedAt")
         VALUES ($1, $2, $3::jsonb, $4, 'PUBLISHED', now()) RETURNING *`,
        [userId, version, JSON.stringify(snapshot), score],
      );
      return rows[0];
    });
  }

  async markLatestPublicationUnpublished(userId: string) {
    const rows = await this.dataSource.query(
      `UPDATE resume_publication_history
       SET status = 'UNPUBLISHED', "unpublishedAt" = now()
       WHERE id = (
         SELECT id FROM resume_publication_history WHERE "userId" = $1 ORDER BY version DESC LIMIT 1
       )
       RETURNING *`,
      [userId],
    );
    return rows[0] || null;
  }

  async listPublicationHistory(userId: string) {
    return this.dataSource.query(
      `SELECT id, version, snapshot, score, status, "publishedAt", "unpublishedAt"
       FROM resume_publication_history WHERE "userId" = $1 ORDER BY version DESC`,
      [userId],
    );
  }
}
