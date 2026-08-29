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
exports.ClassifiedsCommerceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const notifications_service_1 = require("../notifications/notifications.service");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
const classifieds_ai_review_service_1 = require("./classifieds-ai-review.service");
const OFFER_TTL_MS = 48 * 60 * 60 * 1000;
const DEFAULT_LABELS = [
    ['Novo contato', 'BLUE'],
    ['Negociando', 'AMBER'],
    ['Aguardando', 'VIOLET'],
    ['Fechado', 'GREEN'],
    ['Sem interesse', 'STONE'],
];
let ClassifiedsCommerceService = class ClassifiedsCommerceService {
    dataSource;
    identities;
    notifications;
    aiReview;
    expirationTimer = null;
    constructor(dataSource, identities, notifications, aiReview) {
        this.dataSource = dataSource;
        this.identities = identities;
        this.notifications = notifications;
        this.aiReview = aiReview;
    }
    onModuleInit() {
        this.expirationTimer = setInterval(() => {
            void this.expireDueOffers().catch(() => undefined);
        }, 60 * 60 * 1000);
        this.expirationTimer.unref?.();
        void this.expireDueOffers().catch(() => undefined);
    }
    onModuleDestroy() {
        if (this.expirationTimer)
            clearInterval(this.expirationTimer);
    }
    async limits(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY') {
            return { photoLimit: 1, plan: 'FREE', paid: false };
        }
        const rows = await this.dataSource.query(`SELECT plan FROM company_plan_subscriptions
       WHERE "companyId" = $1
         AND status IN ('ACTIVE','PAST_DUE')
         AND "currentPeriodEnd" > now()
         AND plan IN ('PLUS','ELITE')
       ORDER BY "currentPeriodEnd" DESC LIMIT 1`, [identity.company.id]).catch(() => []);
        const plan = String(rows[0]?.plan || 'FREE').toUpperCase();
        const paid = plan === 'PLUS' || plan === 'ELITE';
        return { photoLimit: paid ? 6 : 1, plan: paid ? plan : 'FREE', paid };
    }
    async assertImageLimit(uid, rawImages) {
        if (!Array.isArray(rawImages))
            return this.limits(uid);
        const limits = await this.limits(uid);
        if (rawImages.length > limits.photoLimit) {
            throw new common_1.BadRequestException(limits.photoLimit === 1
                ? 'O plano Free permite 1 foto por anúncio. Planos pagos permitem até 6 fotos.'
                : `Este plano permite até ${limits.photoLimit} fotos por anúncio.`);
        }
        return limits;
    }
    async createOffer(uid, listingId, rawAmount) {
        await this.expireDueOffers().catch(() => undefined);
        const identity = await this.identities.active(uid);
        const amount = this.money(rawAmount);
        if (!amount || Number(amount) <= 0)
            throw new common_1.BadRequestException('Informe um valor de oferta válido.');
        const listingRows = await this.dataSource.query(`SELECT * FROM classified_listings WHERE id = $1 AND status = 'PUBLISHED' LIMIT 1`, [listingId]);
        const listing = listingRows[0];
        if (!listing)
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        if (listing.listingType !== 'PRODUCT' || listing.price == null) {
            throw new common_1.BadRequestException('Ofertas estão disponíveis somente para produtos com preço informado.');
        }
        const buyerCompanyId = identity.type === 'COMPANY' ? identity.company.id : null;
        if (listing.sellerUserId === uid || (buyerCompanyId && listing.companyId === buyerCompanyId)) {
            throw new common_1.BadRequestException('Você não pode fazer oferta no seu próprio anúncio.');
        }
        const existing = buyerCompanyId
            ? await this.dataSource.query(`SELECT * FROM classified_offers WHERE "listingId" = $1 AND "buyerCompanyId" = $2 AND status = 'PENDING' LIMIT 1`, [listingId, buyerCompanyId])
            : await this.dataSource.query(`SELECT * FROM classified_offers WHERE "listingId" = $1 AND "buyerUserId" = $2 AND "buyerCompanyId" IS NULL AND status = 'PENDING' LIMIT 1`, [listingId, uid]);
        const expiresAt = new Date(Date.now() + OFFER_TTL_MS);
        let rows;
        if (existing[0]) {
            rows = await this.dataSource.query(`UPDATE classified_offers
         SET amount = $2, "expiresAt" = $3, "updatedAt" = now()
         WHERE id = $1 RETURNING *`, [existing[0].id, amount, expiresAt]);
        }
        else {
            rows = await this.dataSource.query(`INSERT INTO classified_offers
          ("listingId","buyerUserId","buyerCompanyId","sellerUserId","sellerCompanyId",amount,status,"expiresAt")
         VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7) RETURNING *`, [listingId, uid, buyerCompanyId, listing.sellerUserId, listing.companyId, amount, expiresAt]);
        }
        await this.trackEvent(listingId, 'OFFER', uid, buyerCompanyId, { amount });
        await this.notifyIdentity(listing.sellerUserId, listing.companyId, {
            title: `Nova oferta: ${this.currency(amount)}`,
            message: `Você recebeu uma oferta por “${listing.title}”. Ela fica disponível por 48 horas.`,
            type: 'classified_offer_received',
            link: '/classificados/ofertas',
        });
        return { ...this.decorateOffer(rows[0], listing, 'BUYER'), offerEvent: existing[0] ? 'UPDATED' : 'CREATED' };
    }
    async listOffers(uid) {
        await this.expireDueOffers().catch(() => undefined);
        const identity = await this.identities.active(uid);
        const companyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const rows = companyId
            ? await this.dataSource.query(`SELECT o.*, l.title, l.slug, l.price, l."priceType", l.status AS "listingStatus",
                  i.url AS image, conv.id AS "conversationId",
                  COALESCE(bc.name, bu."socialName", bu."displayName", bu."fullName", 'Comprador') AS "buyerName",
                  COALESCE(sc.name, su."socialName", su."displayName", su."fullName", 'Anunciante') AS "sellerName"
           FROM classified_offers o
           JOIN classified_listings l ON l.id = o."listingId"
           LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId" = l.id ORDER BY "sortOrder" ASC LIMIT 1) i ON true
           LEFT JOIN LATERAL (
             SELECT id FROM classified_conversations
             WHERE "listingId" = o."listingId" AND "buyerUserId" = o."buyerUserId"
               AND (("buyerCompanyId" IS NULL AND o."buyerCompanyId" IS NULL) OR "buyerCompanyId" = o."buyerCompanyId")
             ORDER BY "createdAt" DESC LIMIT 1
           ) conv ON true
           LEFT JOIN users bu ON bu.id = o."buyerUserId"
           LEFT JOIN companies bc ON bc.id = o."buyerCompanyId"
           LEFT JOIN users su ON su.id = o."sellerUserId"
           LEFT JOIN companies sc ON sc.id = o."sellerCompanyId"
           WHERE o."buyerCompanyId" = $1 OR o."sellerCompanyId" = $1
           ORDER BY o."createdAt" DESC`, [companyId])
            : await this.dataSource.query(`SELECT o.*, l.title, l.slug, l.price, l."priceType", l.status AS "listingStatus",
                  i.url AS image, conv.id AS "conversationId",
                  COALESCE(bc.name, bu."socialName", bu."displayName", bu."fullName", 'Comprador') AS "buyerName",
                  COALESCE(sc.name, su."socialName", su."displayName", su."fullName", 'Anunciante') AS "sellerName"
           FROM classified_offers o
           JOIN classified_listings l ON l.id = o."listingId"
           LEFT JOIN LATERAL (SELECT url FROM classified_listing_images WHERE "listingId" = l.id ORDER BY "sortOrder" ASC LIMIT 1) i ON true
           LEFT JOIN LATERAL (
             SELECT id FROM classified_conversations
             WHERE "listingId" = o."listingId" AND "buyerUserId" = o."buyerUserId"
               AND (("buyerCompanyId" IS NULL AND o."buyerCompanyId" IS NULL) OR "buyerCompanyId" = o."buyerCompanyId")
             ORDER BY "createdAt" DESC LIMIT 1
           ) conv ON true
           LEFT JOIN users bu ON bu.id = o."buyerUserId"
           LEFT JOIN companies bc ON bc.id = o."buyerCompanyId"
           LEFT JOIN users su ON su.id = o."sellerUserId"
           LEFT JOIN companies sc ON sc.id = o."sellerCompanyId"
           WHERE (o."buyerUserId" = $1 AND o."buyerCompanyId" IS NULL)
              OR (o."sellerUserId" = $1 AND o."sellerCompanyId" IS NULL)
           ORDER BY o."createdAt" DESC`, [uid]);
        return rows.map((row) => ({
            ...row,
            role: companyId
                ? row.buyerCompanyId === companyId ? 'BUYER' : 'SELLER'
                : !row.buyerCompanyId && row.buyerUserId === uid ? 'BUYER' : 'SELLER',
        }));
    }
    async respondOffer(uid, offerId, rawDecision) {
        await this.expireDueOffers().catch(() => undefined);
        const decision = String(rawDecision || '').toUpperCase();
        if (!['ACCEPTED', 'REJECTED'].includes(decision))
            throw new common_1.BadRequestException('Decisão inválida.');
        const identity = await this.identities.active(uid);
        const rows = await this.dataSource.query(`SELECT o.*, l.title, l.slug FROM classified_offers o
       JOIN classified_listings l ON l.id = o."listingId" WHERE o.id = $1 LIMIT 1`, [offerId]);
        const offer = rows[0];
        if (!offer)
            throw new common_1.NotFoundException('Oferta não encontrada.');
        const sellerAllowed = identity.type === 'COMPANY'
            ? offer.sellerCompanyId === identity.company.id
            : !offer.sellerCompanyId && offer.sellerUserId === uid;
        if (!sellerAllowed)
            throw new common_1.ForbiddenException('Esta oferta pertence a outra identidade.');
        if (offer.status !== 'PENDING')
            throw new common_1.BadRequestException('Esta oferta não está mais pendente.');
        if (new Date(offer.expiresAt).getTime() <= Date.now()) {
            await this.expireDueOffers();
            throw new common_1.BadRequestException('Esta oferta expirou após 48 horas.');
        }
        const updatedRows = await this.dataSource.query(`UPDATE classified_offers SET status = $2, "respondedAt" = now(), "updatedAt" = now()
       WHERE id = $1 AND status = 'PENDING' RETURNING *`, [offerId, decision]);
        const updated = updatedRows[0];
        if (!updated)
            throw new common_1.BadRequestException('A oferta já foi respondida.');
        const accepted = decision === 'ACCEPTED';
        await this.trackEvent(offer.listingId, accepted ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED', uid, identity.type === 'COMPANY' ? identity.company.id : null, { offerId, amount: offer.amount });
        await this.notifyIdentity(offer.buyerUserId, offer.buyerCompanyId, {
            title: accepted ? 'Oferta aceita 🎉' : 'Oferta não aceita',
            message: accepted
                ? `O anunciante aceitou vender “${offer.title}” por ${this.currency(offer.amount)}.`
                : `A oferta de ${this.currency(offer.amount)} por “${offer.title}” não foi aceita.`,
            type: accepted ? 'classified_offer_accepted' : 'classified_offer_rejected',
            link: '/classificados/ofertas',
        });
        return { ...updated, title: offer.title, slug: offer.slug, role: 'SELLER' };
    }
    async withdrawOffer(uid, offerId) {
        const identity = await this.identities.active(uid);
        const rows = await this.dataSource.query(`SELECT * FROM classified_offers WHERE id = $1 LIMIT 1`, [offerId]);
        const offer = rows[0];
        if (!offer)
            throw new common_1.NotFoundException('Oferta não encontrada.');
        const buyerAllowed = identity.type === 'COMPANY'
            ? offer.buyerCompanyId === identity.company.id
            : !offer.buyerCompanyId && offer.buyerUserId === uid;
        if (!buyerAllowed)
            throw new common_1.ForbiddenException('Esta oferta pertence a outra identidade.');
        if (offer.status !== 'PENDING')
            throw new common_1.BadRequestException('Esta oferta não está mais pendente.');
        const updated = await this.dataSource.query(`UPDATE classified_offers SET status = 'WITHDRAWN', "respondedAt" = now(), "updatedAt" = now()
       WHERE id = $1 RETURNING *`, [offerId]);
        return updated[0];
    }
    async expireDueOffers() {
        const rows = await this.dataSource.query(`UPDATE classified_offers SET status = 'EXPIRED', "respondedAt" = now(), "updatedAt" = now()
       WHERE status = 'PENDING' AND "expiresAt" <= now() RETURNING *`).catch(() => []);
        for (const offer of rows) {
            await this.notifyIdentity(offer.buyerUserId, offer.buyerCompanyId, {
                title: 'Oferta expirada',
                message: `Sua oferta de ${this.currency(offer.amount)} não foi respondida em 48 horas e foi encerrada automaticamente.`,
                type: 'classified_offer_expired',
                link: '/classificados/ofertas',
            }).catch(() => undefined);
        }
        return { expired: rows.length };
    }
    async analytics(uid) {
        const identity = await this.identities.active(uid);
        const companyId = identity.type === 'COMPANY' ? identity.company.id : null;
        const listings = companyId
            ? await this.dataSource.query(`SELECT id,title,slug,"listingType",status,"viewsCount","favoritesCount" FROM classified_listings WHERE "companyId" = $1 ORDER BY "updatedAt" DESC`, [companyId])
            : await this.dataSource.query(`SELECT id,title,slug,"listingType",status,"viewsCount","favoritesCount" FROM classified_listings WHERE "sellerUserId" = $1 AND "companyId" IS NULL ORDER BY "updatedAt" DESC`, [uid]);
        const ids = listings.map((item) => item.id);
        if (!ids.length)
            return { totals: { views: 0, favorites: 0, conversations: 0, offers: 0, acceptedOffers: 0, contactClicks: 0 }, listings: [], daily: [] };
        const [conversationRows, offerRows, eventRows, daily] = await Promise.all([
            this.dataSource.query(`SELECT "listingId", count(*)::int AS count FROM classified_conversations WHERE "listingId" = ANY($1::uuid[]) GROUP BY "listingId"`, [ids]),
            this.dataSource.query(`SELECT "listingId", count(*)::int AS offers, count(*) FILTER (WHERE status = 'ACCEPTED')::int AS accepted FROM classified_offers WHERE "listingId" = ANY($1::uuid[]) GROUP BY "listingId"`, [ids]).catch(() => []),
            this.dataSource.query(`SELECT "listingId", count(*) FILTER (WHERE "eventType" = 'CONTACT_CLICK')::int AS contacts FROM classified_listing_events WHERE "listingId" = ANY($1::uuid[]) GROUP BY "listingId"`, [ids]).catch(() => []),
            this.dataSource.query(`SELECT date_trunc('day', "createdAt")::date AS day, "eventType", count(*)::int AS count FROM classified_listing_events WHERE "listingId" = ANY($1::uuid[]) AND "createdAt" >= now() - interval '30 days' GROUP BY 1,2 ORDER BY 1 ASC`, [ids]).catch(() => []),
        ]);
        const conversations = new Map(conversationRows.map((row) => [row.listingId, Number(row.count)]));
        const offers = new Map(offerRows.map((row) => [row.listingId, { offers: Number(row.offers), accepted: Number(row.accepted) }]));
        const contacts = new Map(eventRows.map((row) => [row.listingId, Number(row.contacts)]));
        const enriched = listings.map((listing) => ({
            ...listing,
            views: Number(listing.viewsCount || 0),
            favorites: Number(listing.favoritesCount || 0),
            conversations: conversations.get(listing.id) || 0,
            offers: offers.get(listing.id)?.offers || 0,
            acceptedOffers: offers.get(listing.id)?.accepted || 0,
            contactClicks: contacts.get(listing.id) || 0,
        }));
        return {
            totals: enriched.reduce((acc, item) => ({
                views: acc.views + item.views,
                favorites: acc.favorites + item.favorites,
                conversations: acc.conversations + item.conversations,
                offers: acc.offers + item.offers,
                acceptedOffers: acc.acceptedOffers + item.acceptedOffers,
                contactClicks: acc.contactClicks + item.contactClicks,
            }), { views: 0, favorites: 0, conversations: 0, offers: 0, acceptedOffers: 0, contactClicks: 0 }),
            listings: enriched,
            daily,
        };
    }
    async trackEvent(listingId, eventType, actorUserId = null, actorCompanyId = null, metadata = null) {
        const allowed = ['VIEW', 'FAVORITE', 'CHAT_START', 'OFFER', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'CONTACT_CLICK'];
        if (!allowed.includes(eventType))
            return;
        await this.dataSource.query(`INSERT INTO classified_listing_events ("listingId","actorUserId","actorCompanyId","eventType",metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb)`, [listingId, actorUserId, actorCompanyId, eventType, metadata ? JSON.stringify(metadata) : null]).catch(() => undefined);
    }
    async decorateConversations(uid, conversations) {
        if (!conversations.length)
            return conversations;
        const identity = await this.identities.active(uid);
        const ownerKey = identity.type === 'COMPANY' ? `C:${identity.company.id}` : `P:${uid}`;
        const ids = conversations.map((item) => item.id);
        const prefs = await this.dataSource.query(`SELECT * FROM classified_conversation_preferences WHERE "ownerKey" = $1 AND "conversationId" = ANY($2::uuid[])`, [ownerKey, ids]).catch(() => []);
        const prefMap = new Map(prefs.map((row) => [row.conversationId, row]));
        let labelMap = new Map();
        if (identity.type === 'COMPANY') {
            const labels = await this.companyLabels(uid);
            labelMap = new Map(labels.map((label) => [label.id, label]));
        }
        return conversations.map((conversation) => {
            const pref = prefMap.get(conversation.id);
            const labelIds = Array.isArray(pref?.labels) ? pref.labels : [];
            return {
                ...conversation,
                customName: pref?.customName || null,
                labels: labelIds.map((id) => labelMap.get(id)).filter(Boolean),
            };
        });
    }
    async renameConversation(uid, conversationId, rawName) {
        const { ownerKey } = await this.assertConversationAccess(uid, conversationId);
        const name = String(rawName || '').trim().slice(0, 160) || null;
        const rows = await this.dataSource.query(`INSERT INTO classified_conversation_preferences ("conversationId","ownerKey","customName")
       VALUES ($1,$2,$3)
       ON CONFLICT ("conversationId","ownerKey") DO UPDATE SET "customName" = EXCLUDED."customName", "updatedAt" = now()
       RETURNING *`, [conversationId, ownerKey, name]);
        return rows[0];
    }
    async companyLabels(uid) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            return [];
        await this.ensureDefaultLabels(identity.company.id, uid);
        return this.dataSource.query(`SELECT * FROM classified_chat_labels WHERE "companyId" = $1 ORDER BY "isSystem" DESC, name ASC`, [identity.company.id]);
    }
    async createCompanyLabel(uid, rawName, rawColor) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Etiquetas personalizadas são do workspace Business.');
        const name = String(rawName || '').trim().slice(0, 80);
        if (!name)
            throw new common_1.BadRequestException('Informe o nome da etiqueta.');
        const color = this.color(rawColor);
        try {
            const rows = await this.dataSource.query(`INSERT INTO classified_chat_labels ("companyId",name,"colorKey","isSystem","createdBy") VALUES ($1,$2,$3,false,$4) RETURNING *`, [identity.company.id, name, color, uid]);
            return rows[0];
        }
        catch {
            throw new common_1.BadRequestException('Já existe uma etiqueta com esse nome.');
        }
    }
    async setConversationLabels(uid, conversationId, rawIds) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Etiquetas são exclusivas do workspace Business.');
        const { ownerKey } = await this.assertConversationAccess(uid, conversationId);
        const ids = Array.isArray(rawIds) ? [...new Set(rawIds.map(String).filter(Boolean))].slice(0, 12) : [];
        const allowed = ids.length
            ? await this.dataSource.query(`SELECT id FROM classified_chat_labels WHERE "companyId" = $1 AND id = ANY($2::uuid[])`, [identity.company.id, ids])
            : [];
        const safe = allowed.map((row) => row.id);
        const rows = await this.dataSource.query(`INSERT INTO classified_conversation_preferences ("conversationId","ownerKey",labels)
       VALUES ($1,$2,$3::jsonb)
       ON CONFLICT ("conversationId","ownerKey") DO UPDATE SET labels = EXCLUDED.labels, "updatedAt" = now()
       RETURNING *`, [conversationId, ownerKey, JSON.stringify(safe)]);
        return rows[0];
    }
    async moderatePublishedListing(uid, listingId) {
        const identity = await this.identities.active(uid);
        const ownerWhere = identity.type === 'COMPANY' ? 'l."companyId" = $2' : 'l."sellerUserId" = $2 AND l."companyId" IS NULL';
        const ownerValue = identity.type === 'COMPANY' ? identity.company.id : uid;
        const currentRows = await this.dataSource.query(`SELECT l.*, COALESCE(json_agg(i.url ORDER BY i."sortOrder") FILTER (WHERE i.url IS NOT NULL), '[]') AS images
       FROM classified_listings l LEFT JOIN classified_listing_images i ON i."listingId" = l.id
       WHERE l.id = $1 AND ${ownerWhere}
       GROUP BY l.id LIMIT 1`, [listingId, ownerValue]);
        const listing = currentRows[0];
        if (!listing || listing.status !== 'PUBLISHED')
            return { checked: false, reason: 'NOT_PUBLISHED' };
        const candidates = await this.dataSource.query(`SELECT l.*, COALESCE(json_agg(i.url ORDER BY i."sortOrder") FILTER (WHERE i.url IS NOT NULL), '[]') AS images
       FROM classified_listings l LEFT JOIN classified_listing_images i ON i."listingId" = l.id
       WHERE l.id <> $1 AND ${ownerWhere}
       GROUP BY l.id
       ORDER BY l."updatedAt" DESC LIMIT 20`, [listingId, ownerValue]);
        if (!candidates.length) {
            await this.dataSource.query(`UPDATE classified_listings SET "moderationReviewedAt" = now(), "moderationReason" = NULL, "duplicateOfListingId" = NULL WHERE id = $1`, [listingId]);
            return { checked: true, duplicate: false, reason: 'FIRST_LISTING' };
        }
        const review = await this.aiReview.review({
            listing: this.reviewShape(listing),
            candidates: candidates.map((item) => this.reviewShape(item)),
        });
        if (!review.checked)
            return review;
        if (review.duplicate && review.duplicateListingId) {
            await this.dataSource.query(`UPDATE classified_listings
         SET status = 'PAUSED', "moderationReason" = $2, "duplicateOfListingId" = $3, "moderationReviewedAt" = now(), "updatedAt" = now()
         WHERE id = $1`, [listingId, `Possível anúncio duplicado: ${review.reason}`, review.duplicateListingId]);
            const original = candidates.find((item) => item.id === review.duplicateListingId);
            await this.notifyIdentity(listing.sellerUserId, listing.companyId, {
                title: 'Anúncio pausado por possível duplicidade',
                message: original
                    ? `“${listing.title}” parece repetir “${original.title}”. Edite o anúncio original e arquive este duplicado.`
                    : `“${listing.title}” parece repetir um anúncio anterior. Edite o original e arquive este duplicado.`,
                type: 'classified_duplicate_detected',
                link: '/classificados/anuncios',
            });
            return { ...review, status: 'PAUSED' };
        }
        await this.dataSource.query(`UPDATE classified_listings SET "moderationReason" = NULL, "duplicateOfListingId" = NULL, "moderationReviewedAt" = now() WHERE id = $1`, [listingId]);
        return review;
    }
    reviewShape(row) {
        return {
            id: row.id,
            title: String(row.title || ''),
            description: String(row.description || ''),
            categorySlug: String(row.categorySlug || ''),
            listingType: String(row.listingType || ''),
            price: row.price == null ? null : String(row.price),
            imageUrls: Array.isArray(row.images) ? row.images.map(String).filter(Boolean) : [],
        };
    }
    async assertConversationAccess(uid, conversationId) {
        const identity = await this.identities.active(uid);
        const rows = await this.dataSource.query(`SELECT * FROM classified_conversations WHERE id = $1 LIMIT 1`, [conversationId]);
        const conversation = rows[0];
        if (!conversation)
            throw new common_1.NotFoundException('Conversa não encontrada.');
        if (identity.type === 'COMPANY') {
            const companyId = identity.company.id;
            if (conversation.buyerCompanyId !== companyId && conversation.sellerCompanyId !== companyId) {
                throw new common_1.ForbiddenException('Esta conversa pertence a outra identidade.');
            }
            return { conversation, ownerKey: `C:${companyId}` };
        }
        const allowed = (!conversation.buyerCompanyId && conversation.buyerUserId === uid)
            || (!conversation.sellerCompanyId && conversation.sellerUserId === uid);
        if (!allowed)
            throw new common_1.ForbiddenException('Esta conversa pertence a outra identidade.');
        return { conversation, ownerKey: `P:${uid}` };
    }
    async ensureDefaultLabels(companyId, uid) {
        for (const [name, color] of DEFAULT_LABELS) {
            await this.dataSource.query(`INSERT INTO classified_chat_labels ("companyId",name,"colorKey","isSystem","createdBy")
         VALUES ($1,$2,$3,true,$4) ON CONFLICT DO NOTHING`, [companyId, name, color, uid]).catch(() => undefined);
        }
    }
    async notifyIdentity(userId, companyId, data) {
        const ids = new Set();
        if (userId)
            ids.add(userId);
        if (companyId) {
            const rows = await this.dataSource.query(`SELECT u.id FROM users u WHERE u."companyId" = $1 AND (u."isCompanyAdmin" = true OR u.type = 'ADMIN')
         UNION SELECT c."ownerId" AS id FROM companies c WHERE c.id = $1 AND c."ownerId" IS NOT NULL`, [companyId]).catch(() => []);
            rows.forEach((row) => row.id && ids.add(row.id));
        }
        await Promise.all([...ids].map((id) => this.notifications.notifyUser(id, data).catch(() => undefined)));
    }
    decorateOffer(offer, listing, role) {
        return { ...offer, role, title: listing.title, slug: listing.slug, price: listing.price, priceType: listing.priceType };
    }
    money(value) {
        const parsed = Number(String(value ?? '').replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999_999_999.99)
            return null;
        return parsed.toFixed(2);
    }
    currency(value) {
        const number = Number(value);
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(number) ? number : 0);
    }
    color(value) {
        const color = String(value || '').toUpperCase();
        return ['STONE', 'BLUE', 'AMBER', 'VIOLET', 'GREEN', 'ROSE', 'TEAL'].includes(color) ? color : 'STONE';
    }
};
exports.ClassifiedsCommerceService = ClassifiedsCommerceService;
exports.ClassifiedsCommerceService = ClassifiedsCommerceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService,
        notifications_service_1.NotificationsService,
        classifieds_ai_review_service_1.ClassifiedsAiReviewService])
], ClassifiedsCommerceService);
//# sourceMappingURL=classifieds-commerce.service.js.map