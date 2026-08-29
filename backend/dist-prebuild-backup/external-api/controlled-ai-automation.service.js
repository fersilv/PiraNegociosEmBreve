"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlledAiAutomationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let ControlledAiAutomationService = class ControlledAiAutomationService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    safeLimit(value, max = 200, fallback = 50) {
        const parsed = Math.round(Number(value || fallback));
        return Math.min(max, Math.max(1, Number.isFinite(parsed) ? parsed : fallback));
    }
    async optionalQuery(sql, params = []) {
        try {
            return await this.dataSource.query(sql, params);
        }
        catch (error) {
            if (String(error?.code || '') === '42P01')
                return [];
            throw error;
        }
    }
    async status() {
        const [jobs, listings, reviews, feedback] = await Promise.all([
            this.optionalQuery(`
        SELECT count(*)::int AS pending
        FROM jobs j
        LEFT JOIN job_match_profiles p ON p."jobId" = j.id
        WHERE j.active = true
          AND NOT (p.status = 'READY' AND p."algorithmVersion" IS NOT NULL)
      `),
            this.optionalQuery(`
        SELECT count(*)::int AS pending
        FROM classified_listings
        WHERE status = 'PUBLISHED' AND "moderationReviewedAt" IS NULL
      `),
            this.optionalQuery(`
        SELECT count(*)::int AS pending
        FROM classified_reviews
        WHERE status IN ('PENDING_AI','PENDING_MANUAL')
      `),
            this.optionalQuery(`
        SELECT count(*)::int AS pending
        FROM product_feedback_requests
        WHERE status IN ('NEW','REVIEWING','PLANNED')
      `),
        ]);
        return {
            internalAutomaticAi: false,
            policy: 'O backend não deve chamar modelos de IA por timer, subscriber ou hook de publicação. Agentes externos leem filas e devolvem resultados por MCP.',
            queues: {
                jobMatchProfiles: Number(jobs[0]?.pending || 0),
                classifiedsListings: Number(listings[0]?.pending || 0),
                classifiedsReviews: Number(reviews[0]?.pending || 0),
                productFeedback: Number(feedback[0]?.pending || 0),
            },
        };
    }
    async listingModerationQueue(limitRaw) {
        const limit = this.safeLimit(limitRaw, 200, 50);
        const rows = await this.optionalQuery(`SELECT
         l.id,l.title,l.description,l."categorySlug",l."listingType",l.price,l.status,
         l."sellerUserId",l."companyId",l."createdAt",l."updatedAt",
         l."moderationReviewedAt",l."moderationReason",l."duplicateOfListingId",
         COALESCE(json_agg(i.url ORDER BY i."sortOrder") FILTER (WHERE i.url IS NOT NULL), '[]') AS images
       FROM classified_listings l
       LEFT JOIN classified_listing_images i ON i."listingId" = l.id
       WHERE l.status = 'PUBLISHED' AND l."moderationReviewedAt" IS NULL
       GROUP BY l.id
       ORDER BY l."updatedAt" ASC
       LIMIT $1`, [limit]);
        return { data: rows, count: rows.length, limit };
    }
    async listingModerationContext(listingId, limitRaw) {
        const limit = this.safeLimit(limitRaw, 50, 20);
        const currentRows = await this.optionalQuery(`SELECT l.*,
         COALESCE(json_agg(i.url ORDER BY i."sortOrder") FILTER (WHERE i.url IS NOT NULL), '[]') AS images
       FROM classified_listings l
       LEFT JOIN classified_listing_images i ON i."listingId" = l.id
       WHERE l.id = $1
       GROUP BY l.id LIMIT 1`, [listingId]);
        const listing = currentRows[0];
        if (!listing)
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        const candidates = listing.companyId
            ? await this.optionalQuery(`SELECT l.*,
             COALESCE(json_agg(i.url ORDER BY i."sortOrder") FILTER (WHERE i.url IS NOT NULL), '[]') AS images
           FROM classified_listings l
           LEFT JOIN classified_listing_images i ON i."listingId" = l.id
           WHERE l.id <> $1 AND l."companyId" = $2
           GROUP BY l.id ORDER BY l."updatedAt" DESC LIMIT $3`, [listingId, listing.companyId, limit])
            : await this.optionalQuery(`SELECT l.*,
             COALESCE(json_agg(i.url ORDER BY i."sortOrder") FILTER (WHERE i.url IS NOT NULL), '[]') AS images
           FROM classified_listings l
           LEFT JOIN classified_listing_images i ON i."listingId" = l.id
           WHERE l.id <> $1 AND l."sellerUserId" = $2 AND l."companyId" IS NULL
           GROUP BY l.id ORDER BY l."updatedAt" DESC LIMIT $3`, [listingId, listing.sellerUserId, limit]);
        return { listing, candidates };
    }
    async applyListingModeration(listingId, decisionRaw, reasonRaw, duplicateOfListingId) {
        const decision = String(decisionRaw || '').trim().toUpperCase();
        const reason = String(reasonRaw || '').trim().slice(0, 1200);
        if (!['APPROVE', 'DUPLICATE'].includes(decision)) {
            throw new common_1.BadRequestException('decision deve ser APPROVE ou DUPLICATE.');
        }
        const rows = await this.optionalQuery(`SELECT id,"sellerUserId","companyId",status FROM classified_listings WHERE id = $1 LIMIT 1`, [listingId]);
        const listing = rows[0];
        if (!listing)
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        if (decision === 'DUPLICATE') {
            if (!duplicateOfListingId)
                throw new common_1.BadRequestException('duplicateOfListingId é obrigatório para DUPLICATE.');
            const originals = await this.optionalQuery(`SELECT id,"sellerUserId","companyId" FROM classified_listings WHERE id = $1 LIMIT 1`, [duplicateOfListingId]);
            const original = originals[0];
            if (!original)
                throw new common_1.BadRequestException('O anúncio original informado não existe.');
            const sameOwner = listing.companyId
                ? original.companyId === listing.companyId
                : !original.companyId && original.sellerUserId === listing.sellerUserId;
            if (!sameOwner)
                throw new common_1.BadRequestException('O suposto duplicado pertence a outra identidade.');
            const updated = await this.dataSource.query(`UPDATE classified_listings
         SET status='PAUSED',"moderationReason"=$2,"duplicateOfListingId"=$3,
             "moderationReviewedAt"=now(),"updatedAt"=now()
         WHERE id=$1 RETURNING id,status,"moderationReason","duplicateOfListingId","moderationReviewedAt"`, [listingId, reason || 'Possível anúncio duplicado identificado por moderação externa.', duplicateOfListingId]);
            return updated[0];
        }
        const updated = await this.dataSource.query(`UPDATE classified_listings
       SET "moderationReason"=NULL,"duplicateOfListingId"=NULL,
           "moderationReviewedAt"=now(),"updatedAt"=now()
       WHERE id=$1 RETURNING id,status,"moderationReason","duplicateOfListingId","moderationReviewedAt"`, [listingId]);
        return updated[0];
    }
    async reviewModerationQueue(limitRaw) {
        const limit = this.safeLimit(limitRaw, 200, 50);
        const rows = await this.optionalQuery(`SELECT r.id,r."orderId",r."listingId",r."companyId",r."productRating",r."serviceRating",r."companyRating",
              r.comment,r."photoUrls",r.status,r."moderationReason",r."submittedAt",r."publishAt",
              l.title,l.slug,l."listingType",c.name AS "companyName"
       FROM classified_reviews r
       JOIN classified_listings l ON l.id=r."listingId"
       JOIN companies c ON c.id=r."companyId"
       WHERE r.status IN ('PENDING_AI','PENDING_MANUAL')
       ORDER BY r."createdAt" ASC LIMIT $1`, [limit]);
        return { data: rows, count: rows.length, limit };
    }
    async applyReviewModeration(reviewId, decisionRaw, reasonRaw) {
        const decision = String(decisionRaw || '').trim().toUpperCase();
        if (!['APPROVE', 'REJECT'].includes(decision))
            throw new common_1.BadRequestException('decision deve ser APPROVE ou REJECT.');
        const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        const reason = String(reasonRaw || '').trim().slice(0, 1200)
            || (status === 'APPROVED' ? 'Aprovada pela moderação externa.' : 'Reprovada pela moderação externa.');
        const rows = await this.dataSource.query(`UPDATE classified_reviews
       SET status=$2,"moderationReason"=$3,
           "approvedAt"=CASE WHEN $2='APPROVED' THEN now() ELSE NULL END,
           "rejectedAt"=CASE WHEN $2='REJECTED' THEN now() ELSE NULL END,
           "updatedAt"=now()
       WHERE id=$1
       RETURNING id,status,"moderationReason","approvedAt","rejectedAt","publishAt"`, [reviewId, status, reason]);
        if (!rows[0])
            throw new common_1.NotFoundException('Avaliação não encontrada.');
        return rows[0];
    }
    async feedbackQueue(limitRaw) {
        const limit = this.safeLimit(limitRaw, 500, 200);
        const rows = await this.optionalQuery(`SELECT id,message,"pagePath",process,"profileType",status,"createdAt","updatedAt"
       FROM product_feedback_requests
       WHERE status IN ('NEW','REVIEWING','PLANNED')
       ORDER BY "createdAt" DESC LIMIT $1`, [limit]);
        return { data: rows, count: rows.length, limit };
    }
    async faqSource(limitRaw) {
        const limit = this.safeLimit(limitRaw, 500, 200);
        const rows = await this.optionalQuery(`SELECT id,process,"pagePath",messages,"createdAt","updatedAt"
       FROM product_support_conversations
       WHERE "createdAt" >= now() - interval '90 days'
       ORDER BY "updatedAt" DESC LIMIT $1`, [limit]);
        return { data: rows, count: rows.length, limit };
    }
    async applyFeedbackInsights(clusters) {
        const normalized = clusters.slice(0, 100).map((cluster) => ({
            title: String(cluster.title || '').trim().slice(0, 180),
            summary: String(cluster.summary || '').trim().slice(0, 5000),
            feedbackIds: Array.isArray(cluster.feedbackIds)
                ? [...new Set(cluster.feedbackIds.map(String).filter(Boolean))].slice(0, 500)
                : [],
            score: Math.min(100, Math.max(0, Math.round(Number(cluster.score) || 0))),
            reason: String(cluster.reason || '').trim().slice(0, 2000) || null,
        })).filter((cluster) => cluster.title && cluster.summary && cluster.feedbackIds.length > 0);
        await this.dataSource.transaction(async (manager) => {
            await manager.query('DELETE FROM product_feedback_insights');
            for (const cluster of normalized) {
                await manager.query(`INSERT INTO product_feedback_insights
             (title,summary,"feedbackIds","requestCount",score,reason,source)
           VALUES ($1,$2,$3::jsonb,$4,$5,$6,'EXTERNAL_AI')`, [cluster.title, cluster.summary, JSON.stringify(cluster.feedbackIds), cluster.feedbackIds.length, cluster.score, cluster.reason]);
            }
        });
        return { saved: normalized.length };
    }
    async applyFaqs(articles) {
        let saved = 0;
        for (const article of articles.slice(0, 50)) {
            const title = String(article.title || '').trim().slice(0, 180);
            const summary = String(article.summary || '').trim().slice(0, 5000);
            const body = String(article.body || '').trim().slice(0, 20000);
            const conversationIds = Array.isArray(article.conversationIds)
                ? [...new Set(article.conversationIds.map(String).filter(Boolean))].slice(0, 500)
                : [];
            if (!title || !summary || !body || conversationIds.length < 1)
                continue;
            await this.dataSource.query(`INSERT INTO support_faq_articles
           (slug,title,summary,body,"sourceConversationIds","requestCount","aiGenerated")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,true)
         ON CONFLICT (slug) DO UPDATE SET
           title=CASE WHEN support_faq_articles.status='DRAFT' THEN EXCLUDED.title ELSE support_faq_articles.title END,
           summary=CASE WHEN support_faq_articles.status='DRAFT' THEN EXCLUDED.summary ELSE support_faq_articles.summary END,
           body=CASE WHEN support_faq_articles.status='DRAFT' THEN EXCLUDED.body ELSE support_faq_articles.body END,
           "sourceConversationIds"=EXCLUDED."sourceConversationIds",
           "requestCount"=EXCLUDED."requestCount","updatedAt"=now()`, [this.slug(title), title, summary, body, JSON.stringify(conversationIds), conversationIds.length]);
            saved += 1;
        }
        return { saved };
    }
    slug(value) {
        return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 190)
            || `ajuda-${Date.now()}`;
    }
};
exports.ControlledAiAutomationService = ControlledAiAutomationService;
exports.ControlledAiAutomationService = ControlledAiAutomationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ControlledAiAutomationService);
//# sourceMappingURL=controlled-ai-automation.service.js.map