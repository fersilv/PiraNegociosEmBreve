import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassifiedsReviewModerationService } from './classifieds-review-moderation.service';

@Injectable()
export class ClassifiedsReviewsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly moderation: ClassifiedsReviewModerationService,
  ) {}

  async eligible(uid: string) {
    const rows = await this.dataSource.query(
      `SELECT o.id AS "orderId",o."listingId",o."companyId",o."completedAt",o."auctionId",
              l.title,l.slug,l."listingType",i.url AS image,c.name AS "companyName",
              r.id AS "reviewId",r.status AS "reviewStatus",r."publishAt"
       FROM classified_orders o
       JOIN classified_listings l ON l.id=o."listingId"
       JOIN companies c ON c.id=o."companyId"
       LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC LIMIT 1) i ON true
       LEFT JOIN classified_reviews r ON r."orderId"=o.id
       WHERE o."buyerUserId"=$1 AND o."paymentStatus"='APPROVED' AND o.status='COMPLETED'
       ORDER BY COALESCE(o."completedAt",o."updatedAt") DESC`,
      [uid],
    ).catch(() => []);
    return rows.map((row: any) => ({
      orderId: row.orderId,
      listingId: row.listingId,
      companyId: row.companyId,
      title: row.title,
      slug: row.slug,
      listingType: row.listingType,
      image: row.image || null,
      companyName: row.companyName,
      auctionId: row.auctionId || null,
      completedAt: row.completedAt || null,
      review: row.reviewId ? { id: row.reviewId, status: row.reviewStatus, publishAt: row.publishAt } : null,
      canReview: !row.reviewId || row.reviewStatus === 'REJECTED',
    }));
  }

  async mine(uid: string) {
    const rows = await this.dataSource.query(
      `SELECT r.id,r."orderId",r."listingId",r."companyId",r."productRating",r."serviceRating",r."companyRating",
              r.comment,r."photoUrls",r.status,r."moderationReason",r."submittedAt",r."approvedAt",r."rejectedAt",r."publishAt",
              l.title,l.slug,l."listingType",c.name AS "companyName"
       FROM classified_reviews r JOIN classified_listings l ON l.id=r."listingId" JOIN companies c ON c.id=r."companyId"
       WHERE r."buyerUserId"=$1 ORDER BY r."createdAt" DESC`,
      [uid],
    ).catch(() => []);
    return rows.map((row: any) => ({ ...row, photoUrls: this.array(row.photoUrls), publicNow: row.status === 'APPROVED' && new Date(row.publishAt).getTime() <= Date.now() }));
  }

  async submit(uid: string, orderId: string, body: Record<string, unknown>) {
    const orderRows = await this.dataSource.query(
      `SELECT o.*,l.title,l.slug,l."listingType",c.name AS "companyName"
       FROM classified_orders o JOIN classified_listings l ON l.id=o."listingId" JOIN companies c ON c.id=o."companyId"
       WHERE o.id=$1 AND o."buyerUserId"=$2 LIMIT 1`,
      [orderId, uid],
    );
    const order = orderRows[0];
    if (!order) throw new NotFoundException('Compra não encontrada.');
    if (order.paymentStatus !== 'APPROVED' || order.status !== 'COMPLETED') {
      throw new BadRequestException('A avaliação fica disponível depois que a compra estiver paga e concluída.');
    }

    const existingRows = await this.dataSource.query(`SELECT * FROM classified_reviews WHERE "orderId"=$1 LIMIT 1`, [orderId]);
    const existing = existingRows[0];
    if (existing && existing.buyerUserId !== uid) throw new ForbiddenException('Esta avaliação pertence a outra conta.');
    if (existing && existing.status !== 'REJECTED') throw new BadRequestException('Esta compra já foi avaliada.');

    const productRating = order.listingType === 'PRODUCT' ? this.rating(body.productRating, 'Dê uma nota de 1 a 5 para o produto.') : this.optionalRating(body.productRating);
    const serviceRating = this.optionalRating(body.serviceRating);
    const companyRating = this.optionalRating(body.companyRating);
    if (order.listingType !== 'PRODUCT' && serviceRating == null && companyRating == null) {
      throw new BadRequestException('Dê pelo menos uma nota para atendimento ou empresa.');
    }
    const comment = String(body.comment || '').trim().slice(0, 3000) || null;
    const photoUrls = this.photos(body.photoUrls);
    const result = await this.moderation.moderate({
      comment,
      photoUrls,
      ratings: { productRating, serviceRating, companyRating },
    });
    const status = result.decision === 'REJECT'
      ? 'REJECTED'
      : result.decision === 'APPROVE'
        ? 'APPROVED'
        : result.checked
          ? 'PENDING_MANUAL'
          : 'PENDING_AI';
    const submittedAt = new Date();
    const publishAt = new Date(submittedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const params = [orderId, order.listingId, order.companyId, uid, productRating, serviceRating, companyRating, comment, JSON.stringify(photoUrls), status,
      result.reason, result.provider || null, result.model || null, result.checked ? submittedAt : null, status === 'APPROVED' ? submittedAt : null,
      status === 'REJECTED' ? submittedAt : null, submittedAt, publishAt];
    let rows: any[];
    if (existing) {
      rows = await this.dataSource.query(
        `UPDATE classified_reviews SET
          "productRating"=$5,"serviceRating"=$6,"companyRating"=$7,comment=$8,"photoUrls"=$9::jsonb,status=$10,
          "moderationReason"=$11,"aiProvider"=$12,"aiModel"=$13,"aiCheckedAt"=$14,"approvedAt"=$15,"rejectedAt"=$16,
          "submittedAt"=$17,"publishAt"=$18,"updatedAt"=now()
         WHERE "orderId"=$1 AND "buyerUserId"=$4 RETURNING *`,
        params,
      );
    } else {
      rows = await this.dataSource.query(
        `INSERT INTO classified_reviews
          ("orderId","listingId","companyId","buyerUserId","productRating","serviceRating","companyRating",comment,"photoUrls",status,
           "moderationReason","aiProvider","aiModel","aiCheckedAt","approvedAt","rejectedAt","submittedAt","publishAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        params,
      );
    }
    return this.privateReview(rows[0]);
  }

  async publicListing(listingId: string) {
    const [summaryRows, reviewRows] = await Promise.all([
      this.dataSource.query(
        `SELECT count(*)::int AS count,round(avg("productRating")::numeric,2) AS average
         FROM classified_reviews WHERE "listingId"=$1 AND status='APPROVED' AND "publishAt"<=now() AND "productRating" IS NOT NULL`,
        [listingId],
      ).catch(() => []),
      this.dataSource.query(
        `SELECT id,"productRating","serviceRating","companyRating",comment,"photoUrls","publishAt"
         FROM classified_reviews WHERE "listingId"=$1 AND status='APPROVED' AND "publishAt"<=now()
         ORDER BY "publishAt" DESC LIMIT 100`,
        [listingId],
      ).catch(() => []),
    ]);
    const summary = summaryRows[0] || {};
    return {
      summary: { average: summary.average == null ? null : Number(summary.average), count: Number(summary.count || 0) },
      reviews: reviewRows.map((row: any) => ({
        id: row.id,
        verifiedPurchase: true,
        reviewer: 'Compra verificada',
        productRating: row.productRating == null ? null : Number(row.productRating),
        serviceRating: row.serviceRating == null ? null : Number(row.serviceRating),
        companyRating: row.companyRating == null ? null : Number(row.companyRating),
        comment: row.comment || null,
        photoUrls: this.array(row.photoUrls),
        publishedAt: row.publishAt,
      })),
    };
  }

  async publicCompany(companyId: string) {
    const rows = await this.dataSource.query(
      `SELECT
        count(*) FILTER (WHERE "serviceRating" IS NOT NULL OR "companyRating" IS NOT NULL)::int AS "reviewCount",
        round(avg("serviceRating") FILTER (WHERE "serviceRating" IS NOT NULL)::numeric,2) AS "serviceAverage",
        round(avg("companyRating") FILTER (WHERE "companyRating" IS NOT NULL)::numeric,2) AS "companyAverage"
       FROM classified_reviews WHERE "companyId"=$1 AND status='APPROVED' AND "publishAt"<=now()`,
      [companyId],
    ).catch(() => []);
    const row = rows[0] || {};
    const values = [row.serviceAverage, row.companyAverage].filter((value) => value != null).map(Number);
    return {
      reviewCount: Number(row.reviewCount || 0),
      overallAverage: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null,
      serviceAverage: row.serviceAverage == null ? null : Number(row.serviceAverage),
      companyAverage: row.companyAverage == null ? null : Number(row.companyAverage),
    };
  }

  async pendingModeration() {
    return this.dataSource.query(
      `SELECT r.id,r."orderId",r."listingId",r."companyId",r."productRating",r."serviceRating",r."companyRating",r.comment,r."photoUrls",
              r.status,r."moderationReason",r."submittedAt",l.title,c.name AS "companyName"
       FROM classified_reviews r JOIN classified_listings l ON l.id=r."listingId" JOIN companies c ON c.id=r."companyId"
       WHERE r.status IN ('PENDING_AI','PENDING_MANUAL') ORDER BY r."createdAt" ASC LIMIT 200`,
    ).catch(() => []);
  }

  async moderateManually(reviewId: string, decisionRaw: unknown, reasonRaw: unknown) {
    const decision = String(decisionRaw || '').toUpperCase();
    if (!['APPROVE','REJECT'].includes(decision)) throw new BadRequestException('Decisão inválida.');
    const reason = String(reasonRaw || '').trim().slice(0, 1200) || (decision === 'APPROVE' ? 'Aprovada pela moderação.' : 'Reprovada pela moderação.');
    const rows = await this.dataSource.query(
      `UPDATE classified_reviews SET status=$2,"moderationReason"=$3,
        "approvedAt"=CASE WHEN $2='APPROVED' THEN now() ELSE NULL END,
        "rejectedAt"=CASE WHEN $2='REJECTED' THEN now() ELSE NULL END,"updatedAt"=now()
       WHERE id=$1 RETURNING *`,
      [reviewId, decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', reason],
    );
    if (!rows[0]) throw new NotFoundException('Avaliação não encontrada.');
    return this.privateReview(rows[0]);
  }

  private privateReview(row: any) {
    return {
      id: row.id,
      orderId: row.orderId,
      listingId: row.listingId,
      companyId: row.companyId,
      productRating: row.productRating == null ? null : Number(row.productRating),
      serviceRating: row.serviceRating == null ? null : Number(row.serviceRating),
      companyRating: row.companyRating == null ? null : Number(row.companyRating),
      comment: row.comment || null,
      photoUrls: this.array(row.photoUrls),
      status: row.status,
      moderationReason: row.moderationReason || null,
      submittedAt: row.submittedAt,
      publishAt: row.publishAt,
      publicNow: row.status === 'APPROVED' && new Date(row.publishAt).getTime() <= Date.now(),
    };
  }

  private rating(value: unknown, message: string) {
    const rating = Math.floor(Number(value));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new BadRequestException(message);
    return rating;
  }

  private optionalRating(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    return this.rating(value, 'As notas devem ficar entre 1 e 5 estrelas.');
  }

  private photos(value: unknown) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(String).map((item) => item.trim()).filter((item) => item && item.length <= 1000 && (/^https:\/\//i.test(item) || item.startsWith('/'))))].slice(0, 4);
  }

  private array(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }
}
