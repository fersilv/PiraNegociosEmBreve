import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';
import { PaymentsService } from '../payments/payments.service';
import { PaymentProviderManagerService, type PaymentCheckoutPayer } from '../payments/payment-provider-manager.service';
import { ResumeReviewService } from '../ai/resume-review.service';
import { ResumeImprovementService } from '../ai/resume-improvement.service';
import { User } from '../users/entities/user.entity';

export type PublicResumeProductCode =
  | 'PUBLIC_RESUME_AI_REVIEW'
  | 'PUBLIC_RESUME_AI_IMPROVEMENT'
  | 'PUBLIC_RESUME_REMOVE_WATERMARK';

const PUBLIC_PAYMENT_USER_ID = 'public-resume-system';
const PUBLIC_PRODUCTS = new Set<PublicResumeProductCode>([
  'PUBLIC_RESUME_AI_REVIEW',
  'PUBLIC_RESUME_AI_IMPROVEMENT',
  'PUBLIC_RESUME_REMOVE_WATERMARK',
]);

const PUBLIC_EVENT_TYPES = new Set([
  'LANDING_VIEW',
  'EDITOR_STARTED',
  'SECTION_COMPLETED',
  'TEMPLATE_CHANGED',
  'PREVIEW_VIEWED',
  'RESUME_CREATED',
  'EXPORT_WATERMARKED',
  'EXPORT_CLEAN',
  'ACCOUNT_CTA',
  'SIGNUP_REDIRECT',
  'ACCOUNT_CONVERTED',
  'CHECKOUT_STARTED',
  'CHECKOUT_CREATED',
  'CHECKOUT_PAID',
  'CHECKOUT_EXPIRED',
  'CHECKOUT_CANCELED',
  'WATERMARK_REMOVED',
  'AI_REVIEW_STARTED',
  'AI_REVIEW_COMPLETED',
  'AI_IMPROVEMENT_STARTED',
  'AI_IMPROVEMENT_COMPLETED',
]);

const SAFE_EVENT_METADATA_KEYS = new Set([
  'template', 'completion', 'step', 'section', 'productCode', 'orderId', 'action', 'source',
  'reason', 'method', 'status', 'amountCents', 'hasPhoto', 'experienceCount', 'educationCount',
  'skillCount', 'viewport', 'path', 'cta', 'resultScore', 'changeCount',
]);

@Injectable()
export class PublicResumeService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly payments: PaymentsService,
    private readonly providers: PaymentProviderManagerService,
    private readonly resumeReview: ResumeReviewService,
    private readonly resumeImprovement: ResumeImprovementService,
  ) {}

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private cleanString(value: unknown, max = 200) {
    const text = String(value || '').trim();
    return text ? text.slice(0, max) : null;
  }

  private cleanEventMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (!SAFE_EVENT_METADATA_KEYS.has(key)) continue;
      if (typeof raw === 'boolean') result[key] = raw;
      else if (typeof raw === 'number' && Number.isFinite(raw)) result[key] = raw;
      else if (typeof raw === 'string') result[key] = raw.trim().slice(0, 240);
    }
    return result;
  }

  private async sessionForToken(id: string, token: string) {
    if (!id || !token) throw new ForbiddenException('Sessão pública inválida.');
    const rows = await this.dataSource.query(
      `SELECT * FROM public_resume_sessions WHERE id = $1 LIMIT 1`,
      [id],
    );
    const session = rows[0];
    if (!session || !this.safeEqual(this.hash(token), String(session.tokenHash || ''))) {
      throw new ForbiddenException('Sessão pública inválida ou expirada.');
    }
    await this.dataSource.query(
      `UPDATE public_resume_sessions SET "lastSeenAt" = now(), "updatedAt" = now() WHERE id = $1`,
      [id],
    );
    return session;
  }

  private async insertEvent(sessionId: string, type: string, metadata: Record<string, unknown> = {}) {
    await this.dataSource.query(
      `INSERT INTO public_resume_events ("sessionId", type, metadata) VALUES ($1, $2, $3::jsonb)`,
      [sessionId, type, JSON.stringify(this.cleanEventMetadata(metadata))],
    );
  }

  async createSession(
    input: Record<string, unknown>,
    context: { userAgent?: string; referrer?: string },
  ) {
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    await this.dataSource.query(
      `INSERT INTO public_resume_sessions
        (id, "tokenHash", "userAgent", referrer, "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        this.hash(token),
        this.cleanString(context.userAgent, 500),
        this.cleanString(context.referrer, 2000),
        this.cleanString(input.utmSource, 160),
        this.cleanString(input.utmMedium, 160),
        this.cleanString(input.utmCampaign, 200),
        this.cleanString(input.utmContent, 200),
        this.cleanString(input.utmTerm, 200),
      ],
    );
    await this.insertEvent(id, 'LANDING_VIEW', {
      source: this.cleanString(input.utmSource, 160) || (context.referrer ? 'referral' : 'direct'),
      path: '/criador-de-curriculo',
    });
    return { id, token, watermarkUnlocked: false, createdAt: new Date().toISOString() };
  }

  async getSession(id: string, token: string) {
    const session = await this.sessionForToken(id, token);
    return {
      id: session.id,
      status: session.status,
      watermarkUnlocked: Boolean(session.watermarkUnlocked),
      converted: Boolean(session.convertedUserId),
      startedAt: session.startedAt,
      lastSeenAt: session.lastSeenAt,
    };
  }

  async track(id: string, token: string, typeInput: unknown, metadataInput?: unknown) {
    await this.sessionForToken(id, token);
    const type = String(typeInput || '').trim().toUpperCase();
    if (!PUBLIC_EVENT_TYPES.has(type)) throw new BadRequestException('Evento público inválido.');
    const metadata = this.cleanEventMetadata(metadataInput);
    await this.insertEvent(id, type, metadata);
    if (type === 'RESUME_CREATED') {
      await this.dataSource.query(
        `UPDATE public_resume_sessions SET status = CASE WHEN status = 'ACTIVE' THEN 'COMPLETED' ELSE status END,
           "completedAt" = coalesce("completedAt", now()), "updatedAt" = now() WHERE id = $1`,
        [id],
      );
    }
    return { ok: true };
  }

  async catalog() {
    const rows = await this.dataSource.query(
      `SELECT code, name, description, "priceCents", "promotionalPriceCents", "promotionStartsAt", "promotionEndsAt", enabled
       FROM payment_products
       WHERE code = ANY($1::varchar[]) AND enabled = true
       ORDER BY "sortOrder" ASC`,
      [Array.from(PUBLIC_PRODUCTS)],
    );
    return rows.map((row: any) => {
      const now = Date.now();
      const start = row.promotionStartsAt ? new Date(row.promotionStartsAt).getTime() : Number.NEGATIVE_INFINITY;
      const end = row.promotionEndsAt ? new Date(row.promotionEndsAt).getTime() : Number.POSITIVE_INFINITY;
      const promo = row.promotionalPriceCents !== null && row.promotionalPriceCents !== undefined && now >= start && now <= end
        ? Number(row.promotionalPriceCents)
        : null;
      return {
        ...row,
        effectivePriceCents: promo ?? Number(row.priceCents || 0),
        promotionActive: promo !== null,
      };
    });
  }

  private normalizeProductCode(value: unknown): PublicResumeProductCode {
    const code = String(value || '').trim().toUpperCase() as PublicResumeProductCode;
    if (!PUBLIC_PRODUCTS.has(code)) throw new BadRequestException('Produto indisponível no criador público.');
    return code;
  }

  private publicOrder(order: any) {
    return {
      id: order.id,
      productCode: order.productCode,
      status: order.status,
      amountCents: Number(order.amountCents || 0),
      provider: order.provider || null,
      pixCopyPaste: order.pixCopyPaste || null,
      qrCodeBase64: order.qrCodeBase64 || null,
      expiresAt: order.expiresAt || null,
      paidAt: order.paidAt || null,
      consumedAt: order.consumedAt || null,
      createdAt: order.createdAt,
    };
  }

  private async recordPaidEventOnce(order: any) {
    const existing = await this.dataSource.query(
      `SELECT id FROM public_resume_events
       WHERE "sessionId" = $1 AND type = 'CHECKOUT_PAID' AND metadata->>'orderId' = $2 LIMIT 1`,
      [order.sessionId, String(order.id)],
    );
    if (existing[0]) return;
    await this.insertEvent(order.sessionId, 'CHECKOUT_PAID', {
      productCode: order.productCode,
      orderId: order.id,
      amountCents: Number(order.amountCents || 0),
    });
  }

  private async syncOrderFromPayment(orderId: string, sessionId?: string) {
    const rows = await this.dataSource.query(
      `SELECT o.*, p.status AS "paymentStatus", p.provider AS "paymentProvider",
         p."providerPaymentId" AS "paymentProviderPaymentId", p."pixCopyPaste" AS "paymentPixCopyPaste",
         p."qrCodeBase64" AS "paymentQrCodeBase64", p."expiresAt" AS "paymentExpiresAt",
         p."paidAt" AS "paymentPaidAt", p."canceledAt" AS "paymentCanceledAt", p."isSimulation" AS "paymentIsSimulation"
       FROM public_resume_orders o
       LEFT JOIN payments p ON p.id = o."paymentId"
       WHERE o.id = $1 ${sessionId ? 'AND o."sessionId" = $2' : ''} LIMIT 1`,
      sessionId ? [orderId, sessionId] : [orderId],
    );
    const order = rows[0];
    if (!order) throw new NotFoundException('Pedido público não encontrado.');
    const nextStatus = String(order.paymentStatus || order.status || 'PENDING');
    const previousStatus = String(order.status || 'PENDING');
    const updatedRows = await this.dataSource.query(
      `UPDATE public_resume_orders SET
         status = $2,
         provider = coalesce($3, provider),
         "providerPaymentId" = coalesce($4, "providerPaymentId"),
         "pixCopyPaste" = coalesce($5, "pixCopyPaste"),
         "qrCodeBase64" = coalesce($6, "qrCodeBase64"),
         "expiresAt" = coalesce($7, "expiresAt"),
         "paidAt" = coalesce($8, "paidAt"),
         "canceledAt" = coalesce($9, "canceledAt"),
         "isSimulation" = coalesce($10, "isSimulation"),
         "updatedAt" = now()
       WHERE id = $1 RETURNING *`,
      [
        order.id,
        nextStatus,
        order.paymentProvider || null,
        order.paymentProviderPaymentId || null,
        order.paymentPixCopyPaste || null,
        order.paymentQrCodeBase64 || null,
        order.paymentExpiresAt || null,
        order.paymentPaidAt || null,
        order.paymentCanceledAt || null,
        order.paymentIsSimulation ?? false,
      ],
    );
    const updated = updatedRows[0] || order;
    if (nextStatus === 'PAID') {
      if (updated.productCode === 'PUBLIC_RESUME_REMOVE_WATERMARK') {
        await this.dataSource.query(
          `UPDATE public_resume_sessions SET "watermarkUnlocked" = true, "updatedAt" = now() WHERE id = $1`,
          [updated.sessionId],
        );
      }
      if (previousStatus !== 'PAID') await this.recordPaidEventOnce(updated);
    }
    if (nextStatus === 'EXPIRED' && previousStatus !== 'EXPIRED') {
      await this.insertEvent(updated.sessionId, 'CHECKOUT_EXPIRED', {
        productCode: updated.productCode,
        orderId: updated.id,
      });
    }
    if (nextStatus === 'CANCELED' && previousStatus !== 'CANCELED') {
      await this.insertEvent(updated.sessionId, 'CHECKOUT_CANCELED', {
        productCode: updated.productCode,
        orderId: updated.id,
      });
    }
    return updated;
  }

  async createCheckout(
    sessionId: string,
    token: string,
    input: { productCode?: unknown; payer?: PaymentCheckoutPayer },
  ) {
    await this.sessionForToken(sessionId, token);
    const productCode = this.normalizeProductCode(input.productCode);
    const product = await this.payments.findProduct(productCode, false);
    const amountCents = Number(product.effectivePriceCents || 0);
    if (amountCents <= 0) throw new BadRequestException('Este recurso não exige pagamento no momento.');

    await this.insertEvent(sessionId, 'CHECKOUT_STARTED', { productCode, amountCents });
    const corePayment = await this.payments.createPixPayment(PUBLIC_PAYMENT_USER_ID, productCode);
    const orderId = randomUUID();
    const payerEmail = this.cleanString(input.payer?.email, 320);
    await this.dataSource.query(
      `INSERT INTO public_resume_orders
        (id, "sessionId", "paymentId", "productCode", "originalAmountCents", "amountCents", "discountCents", "payerEmail", metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        orderId,
        sessionId,
        corePayment.id,
        productCode,
        Number(corePayment.originalAmountCents || product.originalPriceCents || amountCents),
        Number(corePayment.amountCents || amountCents),
        Number(corePayment.discountCents || 0),
        payerEmail,
        JSON.stringify({ promotionActive: Boolean(product.promotionActive) }),
      ],
    );
    await this.dataSource.query(
      `UPDATE payments SET metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, "updatedAt" = now() WHERE id = $1`,
      [corePayment.id, JSON.stringify({ publicResume: true, publicResumeSessionId: sessionId, publicResumeOrderId: orderId })],
    );

    const devMode = await this.payments.getDevMode();
    if (devMode.enabled) {
      await this.payments.simulatePayment(corePayment.id, PUBLIC_PAYMENT_USER_ID);
      const paid = await this.syncOrderFromPayment(orderId, sessionId);
      return {
        ...this.publicOrder(paid),
        product,
        checkoutReady: false,
        paymentRequired: false,
        devSimulation: true,
      };
    }

    try {
      const checkout = await this.providers.createCheckout(corePayment, input.payer || {});
      await this.payments.attachProviderCheckout(corePayment.id, checkout);
      const stored = await this.syncOrderFromPayment(orderId, sessionId);
      await this.insertEvent(sessionId, 'CHECKOUT_CREATED', {
        productCode,
        orderId,
        amountCents,
        method: 'PIX',
      });
      return {
        ...this.publicOrder(stored),
        product,
        checkoutReady: Boolean(stored?.pixCopyPaste || stored?.qrCodeBase64),
        paymentRequired: true,
      };
    } catch (error) {
      await this.payments.cancelProviderCheckout(corePayment.id, error).catch(() => undefined);
      await this.syncOrderFromPayment(orderId, sessionId).catch(() => undefined);
      await this.insertEvent(sessionId, 'CHECKOUT_CANCELED', {
        productCode,
        orderId,
        reason: 'provider_error',
      });
      throw error;
    }
  }

  async getOrder(sessionId: string, token: string, orderId: string) {
    await this.sessionForToken(sessionId, token);
    let order = await this.syncOrderFromPayment(orderId, sessionId);
    const expiresAt = order.expiresAt
      ? new Date(order.expiresAt).getTime()
      : new Date(order.createdAt).getTime() + 2 * 60 * 60 * 1000;
    if (order.status === 'PENDING' && expiresAt < Date.now()) {
      if (order.paymentId) {
        await this.dataSource.query(
          `UPDATE payments SET status = 'EXPIRED', "updatedAt" = now() WHERE id = $1 AND status = 'PENDING'`,
          [order.paymentId],
        );
      }
      order = await this.syncOrderFromPayment(orderId, sessionId);
    }
    const session = await this.dataSource.query(
      `SELECT "watermarkUnlocked" FROM public_resume_sessions WHERE id = $1`,
      [sessionId],
    );
    return { ...this.publicOrder(order), watermarkUnlocked: Boolean(session[0]?.watermarkUnlocked) };
  }

  private async claimPaidOrder(sessionId: string, orderId: string, productCode: PublicResumeProductCode) {
    await this.syncOrderFromPayment(orderId, sessionId);
    const rows = await this.dataSource.query(
      `UPDATE public_resume_orders SET "consumedAt" = now(), "updatedAt" = now()
       WHERE id = $1 AND "sessionId" = $2 AND "productCode" = $3 AND status = 'PAID' AND "consumedAt" IS NULL
       RETURNING *`,
      [orderId, sessionId, productCode],
    );
    if (!rows[0]) throw new BadRequestException('Este pagamento não está aprovado ou já foi utilizado.');
    return rows[0];
  }

  private releaseClaim(orderId: string) {
    return this.dataSource.query(
      `UPDATE public_resume_orders SET "consumedAt" = NULL, "updatedAt" = now() WHERE id = $1`,
      [orderId],
    );
  }

  async reviewWithAi(sessionId: string, token: string, orderId: string, profile: unknown) {
    await this.sessionForToken(sessionId, token);
    await this.claimPaidOrder(sessionId, orderId, 'PUBLIC_RESUME_AI_REVIEW');
    await this.insertEvent(sessionId, 'AI_REVIEW_STARTED', {
      orderId,
      productCode: 'PUBLIC_RESUME_AI_REVIEW',
    });
    try {
      const analysis = await this.resumeReview.review(profile);
      await this.insertEvent(sessionId, 'AI_REVIEW_COMPLETED', {
        orderId,
        resultScore: analysis.score,
      });
      return analysis;
    } catch (error) {
      await this.releaseClaim(orderId).catch(() => undefined);
      throw error;
    }
  }

  async improveWithAi(sessionId: string, token: string, orderId: string, profile: unknown) {
    await this.sessionForToken(sessionId, token);
    await this.claimPaidOrder(sessionId, orderId, 'PUBLIC_RESUME_AI_IMPROVEMENT');
    await this.insertEvent(sessionId, 'AI_IMPROVEMENT_STARTED', {
      orderId,
      productCode: 'PUBLIC_RESUME_AI_IMPROVEMENT',
    });
    try {
      const proposal = await this.resumeImprovement.propose(profile as User);
      await this.insertEvent(sessionId, 'AI_IMPROVEMENT_COMPLETED', {
        orderId,
        changeCount: Array.isArray(proposal?.changes) ? proposal.changes.length : 0,
      });
      return proposal;
    } catch (error) {
      await this.releaseClaim(orderId).catch(() => undefined);
      throw error;
    }
  }

  async unlockWatermark(sessionId: string, token: string, orderId: string) {
    await this.sessionForToken(sessionId, token);
    const order = await this.syncOrderFromPayment(orderId, sessionId);
    if (order.productCode !== 'PUBLIC_RESUME_REMOVE_WATERMARK' || order.status !== 'PAID') {
      throw new BadRequestException('O pagamento para remover a marca ainda não foi confirmado.');
    }
    await this.dataSource.query(
      `UPDATE public_resume_sessions SET "watermarkUnlocked" = true, "updatedAt" = now() WHERE id = $1`,
      [sessionId],
    );
    await this.insertEvent(sessionId, 'WATERMARK_REMOVED', {
      orderId,
      productCode: 'PUBLIC_RESUME_REMOVE_WATERMARK',
    });
    return { watermarkUnlocked: true };
  }

  async linkAccount(sessionId: string, token: string, userId: string) {
    await this.sessionForToken(sessionId, token);
    const rows = await this.dataSource.query(
      `UPDATE public_resume_sessions SET "convertedUserId" = $2, "convertedAt" = coalesce("convertedAt", now()),
         status = 'CONVERTED', "updatedAt" = now() WHERE id = $1 RETURNING id`,
      [sessionId, userId],
    );
    if (!rows[0]) throw new NotFoundException('Sessão pública não encontrada.');
    const already = await this.dataSource.query(
      `SELECT id FROM public_resume_events WHERE "sessionId" = $1 AND type = 'ACCOUNT_CONVERTED' LIMIT 1`,
      [sessionId],
    );
    if (!already[0]) await this.insertEvent(sessionId, 'ACCOUNT_CONVERTED', { source: 'authenticated_bridge' });
    return { ok: true };
  }

  private async syncAllOrders() {
    await this.dataSource.query(`
      UPDATE public_resume_orders o SET
        status = p.status,
        provider = coalesce(p.provider, o.provider),
        "providerPaymentId" = coalesce(p."providerPaymentId", o."providerPaymentId"),
        "pixCopyPaste" = coalesce(p."pixCopyPaste", o."pixCopyPaste"),
        "qrCodeBase64" = coalesce(p."qrCodeBase64", o."qrCodeBase64"),
        "expiresAt" = coalesce(p."expiresAt", o."expiresAt"),
        "paidAt" = coalesce(p."paidAt", o."paidAt"),
        "canceledAt" = coalesce(p."canceledAt", o."canceledAt"),
        "isSimulation" = p."isSimulation",
        "updatedAt" = now()
      FROM payments p
      WHERE p.id = o."paymentId" AND (
        o.status IS DISTINCT FROM p.status OR
        o.provider IS DISTINCT FROM p.provider OR
        o."providerPaymentId" IS DISTINCT FROM p."providerPaymentId" OR
        o."paidAt" IS DISTINCT FROM p."paidAt"
      )
    `);
    await this.dataSource.query(`
      UPDATE public_resume_sessions s SET "watermarkUnlocked" = true, "updatedAt" = now()
      WHERE EXISTS (
        SELECT 1 FROM public_resume_orders o
        WHERE o."sessionId" = s.id
          AND o."productCode" = 'PUBLIC_RESUME_REMOVE_WATERMARK'
          AND o.status = 'PAID'
      ) AND s."watermarkUnlocked" = false
    `);
    await this.dataSource.query(`
      INSERT INTO public_resume_events ("sessionId", type, metadata)
      SELECT o."sessionId", 'CHECKOUT_PAID', jsonb_build_object(
        'productCode', o."productCode", 'orderId', o.id::text, 'amountCents', o."amountCents"
      )
      FROM public_resume_orders o
      WHERE o.status = 'PAID'
        AND NOT EXISTS (
          SELECT 1 FROM public_resume_events e
          WHERE e."sessionId" = o."sessionId" AND e.type = 'CHECKOUT_PAID'
            AND e.metadata->>'orderId' = o.id::text
        )
    `);
  }

  async adminSummary(daysInput: number) {
    const days = Math.min(365, Math.max(1, Math.round(daysInput || 30)));
    await this.dataSource.query(
      `UPDATE payments SET status = 'EXPIRED', "updatedAt" = now()
       WHERE id IN (
         SELECT o."paymentId" FROM public_resume_orders o
         WHERE o.status = 'PENDING' AND coalesce(o."expiresAt", o."createdAt" + interval '2 hours') < now()
       ) AND status = 'PENDING'`,
    );
    await this.syncAllOrders();

    const [sessionRows, orderRows, funnelRows, productRows, sourceRows, templateRows, recentOrders, recentEvents] = await Promise.all([
      this.dataSource.query(`
        SELECT
          count(*)::int AS sessions,
          count(*) FILTER (WHERE "completedAt" IS NOT NULL)::int AS "resumesCreated",
          count(*) FILTER (WHERE "convertedAt" IS NOT NULL)::int AS "accountConversions"
        FROM public_resume_sessions WHERE "createdAt" >= now() - ($1::int * interval '1 day')`, [days]),
      this.dataSource.query(`
        SELECT
          count(*) FILTER (WHERE "isSimulation" = false)::int AS checkouts,
          count(*) FILTER (WHERE status = 'PAID' AND "isSimulation" = false)::int AS sales,
          coalesce(sum("amountCents") FILTER (WHERE status = 'PAID' AND "isSimulation" = false),0)::int AS revenue,
          count(*) FILTER (WHERE status IN ('EXPIRED','CANCELED') AND "isSimulation" = false)::int AS abandoned,
          count(*) FILTER (WHERE status = 'PENDING' AND "isSimulation" = false AND "createdAt" < now() - interval '30 minutes')::int AS "pendingOver30m"
        FROM public_resume_orders WHERE "createdAt" >= now() - ($1::int * interval '1 day')`, [days]),
      this.dataSource.query(`
        SELECT type, count(DISTINCT "sessionId")::int AS sessions
        FROM public_resume_events
        WHERE "createdAt" >= now() - ($1::int * interval '1 day')
          AND type = ANY($2::varchar[])
        GROUP BY type`, [days, ['EDITOR_STARTED','PREVIEW_VIEWED','RESUME_CREATED','EXPORT_WATERMARKED','CHECKOUT_STARTED','CHECKOUT_PAID','ACCOUNT_CTA','ACCOUNT_CONVERTED']]),
      this.dataSource.query(`
        SELECT o."productCode", pp.name,
          count(*) FILTER (WHERE o."isSimulation" = false)::int AS checkouts,
          count(*) FILTER (WHERE o.status = 'PAID' AND o."isSimulation" = false)::int AS sales,
          coalesce(sum(o."amountCents") FILTER (WHERE o.status = 'PAID' AND o."isSimulation" = false),0)::int AS revenue,
          count(*) FILTER (WHERE o.status IN ('EXPIRED','CANCELED') AND o."isSimulation" = false)::int AS abandoned
        FROM public_resume_orders o
        LEFT JOIN payment_products pp ON pp.code = o."productCode"
        WHERE o."createdAt" >= now() - ($1::int * interval '1 day')
        GROUP BY o."productCode", pp.name ORDER BY revenue DESC, sales DESC`, [days]),
      this.dataSource.query(`
        SELECT coalesce(nullif("utmSource",''), CASE WHEN referrer IS NULL OR referrer = '' THEN 'Direto' ELSE left(referrer,120) END) AS source,
          count(*)::int AS sessions,
          count(*) FILTER (WHERE "completedAt" IS NOT NULL)::int AS completed,
          count(*) FILTER (WHERE "convertedAt" IS NOT NULL)::int AS converted
        FROM public_resume_sessions
        WHERE "createdAt" >= now() - ($1::int * interval '1 day')
        GROUP BY 1 ORDER BY sessions DESC LIMIT 20`, [days]),
      this.dataSource.query(`
        SELECT metadata->>'template' AS template, count(*)::int AS events, count(DISTINCT "sessionId")::int AS sessions
        FROM public_resume_events
        WHERE "createdAt" >= now() - ($1::int * interval '1 day')
          AND type = 'TEMPLATE_CHANGED' AND coalesce(metadata->>'template','') <> ''
        GROUP BY metadata->>'template' ORDER BY sessions DESC`, [days]),
      this.dataSource.query(`
        SELECT o.id, o."sessionId", o."productCode", pp.name AS "productName", o.status, o."amountCents", o.provider,
          o."payerEmail", o."isSimulation", o."createdAt", o."paidAt", o."expiresAt"
        FROM public_resume_orders o LEFT JOIN payment_products pp ON pp.code = o."productCode"
        ORDER BY o."createdAt" DESC LIMIT 80`),
      this.dataSource.query(`
        SELECT id, "sessionId", type, metadata, "createdAt"
        FROM public_resume_events ORDER BY "createdAt" DESC LIMIT 100`),
    ]);

    const sessions = Number(sessionRows[0]?.sessions || 0);
    const resumesCreated = Number(sessionRows[0]?.resumesCreated || 0);
    const checkouts = Number(orderRows[0]?.checkouts || 0);
    const sales = Number(orderRows[0]?.sales || 0);
    const abandoned = Number(orderRows[0]?.abandoned || 0) + Number(orderRows[0]?.pendingOver30m || 0);
    const funnelMap = Object.fromEntries(funnelRows.map((row: any) => [row.type, Number(row.sessions || 0)]));
    return {
      periodDays: days,
      metrics: {
        sessions,
        resumesCreated,
        accountConversions: Number(sessionRows[0]?.accountConversions || 0),
        checkouts,
        sales,
        revenueCents: Number(orderRows[0]?.revenue || 0),
        abandoned,
        sessionToResumePercent: sessions ? Math.round((resumesCreated / sessions) * 1000) / 10 : 0,
        checkoutConversionPercent: checkouts ? Math.round((sales / checkouts) * 1000) / 10 : 0,
        checkoutAbandonmentPercent: checkouts ? Math.round((abandoned / checkouts) * 1000) / 10 : 0,
      },
      funnel: [
        { key: 'LANDING', label: 'Sessões', value: sessions },
        { key: 'EDITOR_STARTED', label: 'Iniciaram o editor', value: funnelMap.EDITOR_STARTED || 0 },
        { key: 'PREVIEW_VIEWED', label: 'Visualizaram o currículo', value: funnelMap.PREVIEW_VIEWED || 0 },
        { key: 'RESUME_CREATED', label: 'Currículos criados', value: funnelMap.RESUME_CREATED || resumesCreated },
        { key: 'EXPORT_WATERMARKED', label: 'Exportaram com marca', value: funnelMap.EXPORT_WATERMARKED || 0 },
        { key: 'CHECKOUT_STARTED', label: 'Iniciaram compra', value: funnelMap.CHECKOUT_STARTED || 0 },
        { key: 'CHECKOUT_PAID', label: 'Pagaram', value: funnelMap.CHECKOUT_PAID || 0 },
        { key: 'ACCOUNT_CTA', label: 'Clicaram para criar conta', value: funnelMap.ACCOUNT_CTA || 0 },
        { key: 'ACCOUNT_CONVERTED', label: 'Converteram em conta', value: funnelMap.ACCOUNT_CONVERTED || 0 },
      ],
      products: productRows.map((row: any) => ({
        ...row,
        checkouts: Number(row.checkouts || 0),
        sales: Number(row.sales || 0),
        revenueCents: Number(row.revenue || 0),
        abandoned: Number(row.abandoned || 0),
        conversionPercent: Number(row.checkouts || 0)
          ? Math.round((Number(row.sales || 0) / Number(row.checkouts)) * 1000) / 10
          : 0,
      })),
      sources: sourceRows,
      templates: templateRows,
      recentOrders,
      recentEvents,
    };
  }
}
