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
exports.ClassifiedsCatalogAdminService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const LISTING_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'PAUSED', 'SOLD', 'ARCHIVED', 'PENDING_REVIEW']);
const LISTING_TYPES = new Set(['PRODUCT', 'SERVICE']);
const AUCTION_STATUSES = new Set(['SCHEDULED', 'OPEN', 'ENDED', 'CANCELED']);
let ClassifiedsCatalogAdminService = class ClassifiedsCatalogAdminService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async summary() {
        await this.ensureSchema();
        const [listingRows, auctionRows] = await Promise.all([
            this.dataSource.query(`
        SELECT
          count(*) FILTER (WHERE "listingType"='PRODUCT' AND status<>'ARCHIVED' AND "deletedAt" IS NULL)::int AS products,
          count(*) FILTER (WHERE "listingType"='SERVICE' AND status<>'ARCHIVED' AND "deletedAt" IS NULL)::int AS services,
          count(*) FILTER (WHERE status='PUBLISHED' AND "deletedAt" IS NULL)::int AS published,
          count(*) FILTER (WHERE status='PAUSED' AND "deletedAt" IS NULL)::int AS paused,
          count(*) FILTER (WHERE status='PENDING_REVIEW' AND "deletedAt" IS NULL)::int AS pending_review,
          count(*) FILTER (WHERE status='ARCHIVED' AND "deletedAt" IS NULL)::int AS archived
        FROM classified_listings
      `),
            this.dataSource.query(`
        SELECT
          count(*) FILTER (WHERE "archivedAt" IS NULL AND "deletedAt" IS NULL)::int AS auctions,
          count(*) FILTER (WHERE "archivedAt" IS NULL AND "deletedAt" IS NULL AND status IN ('SCHEDULED','OPEN'))::int AS active_auctions,
          count(*) FILTER (WHERE "archivedAt" IS NOT NULL AND "deletedAt" IS NULL)::int AS archived_auctions
        FROM classified_auctions
      `).catch(() => [{ auctions: 0, active_auctions: 0, archived_auctions: 0 }]),
        ]);
        const l = listingRows[0] || {};
        const a = auctionRows[0] || {};
        return {
            products: Number(l.products || 0),
            services: Number(l.services || 0),
            published: Number(l.published || 0),
            paused: Number(l.paused || 0),
            pendingReview: Number(l.pending_review || 0),
            archivedListings: Number(l.archived || 0),
            auctions: Number(a.auctions || 0),
            activeAuctions: Number(a.active_auctions || 0),
            archivedAuctions: Number(a.archived_auctions || 0),
        };
    }
    async listings(query) {
        await this.ensureSchema();
        const typeRaw = String(query.type || 'ALL').toUpperCase();
        const statusRaw = String(query.status || 'ALL').toUpperCase();
        const archived = String(query.archived || 'false').toLowerCase() === 'true';
        const q = String(query.q || '').trim().slice(0, 160);
        const page = Math.max(1, Number(query.page) || 1);
        const pageSize = Math.max(10, Math.min(100, Number(query.pageSize) || 30));
        const offset = (page - 1) * pageSize;
        const filters = [
            `l."deletedAt" IS NULL`,
            archived ? `l.status='ARCHIVED'` : `l.status<>'ARCHIVED'`,
        ];
        const params = [];
        if (typeRaw !== 'ALL') {
            if (!LISTING_TYPES.has(typeRaw))
                throw new common_1.BadRequestException('Tipo de anúncio inválido.');
            params.push(typeRaw);
            filters.push(`l."listingType"=$${params.length}::varchar`);
        }
        if (statusRaw !== 'ALL') {
            if (!LISTING_STATUSES.has(statusRaw))
                throw new common_1.BadRequestException('Status de anúncio inválido.');
            params.push(statusRaw);
            filters.push(`l.status=$${params.length}::varchar`);
        }
        if (q) {
            params.push(`%${q}%`);
            filters.push(`(
        l.title ILIKE $${params.length}::text
        OR l.description ILIKE $${params.length}::text
        OR COALESCE(c.name,'') ILIKE $${params.length}::text
        OR COALESCE(u.email,'') ILIKE $${params.length}::text
        OR COALESCE(u."displayName",u."fullName",u."socialName",'') ILIKE $${params.length}::text
      )`);
        }
        params.push(pageSize, offset);
        const limitIndex = params.length - 1;
        const offsetIndex = params.length;
        const rows = await this.dataSource.query(`
      SELECT
        l.id,l.slug,l."sellerUserId",l."companyId",l."categorySlug",l."listingType",l.title,l.description,
        l.price,l."priceType",l.condition,l.city,l.state,l.status,l."isFeatured",l."moderationReason",l.attributes,
        l."moderationReviewedAt",l."publishedAt",l."createdAt",l."updatedAt",l."archivedAt",l."archivedByUserId",
        l."deletedAt",l."deletedByUserId",
        cat.name AS "categoryName",
        c.name AS "companyName",
        COALESCE(u."socialName",u."displayName",u."fullName",u.email,'Usuário') AS "sellerName",
        u.email AS "sellerEmail",
        img.url AS image,
        EXISTS(
          SELECT 1 FROM classified_auctions a
          WHERE a."listingId"=l.id AND a."archivedAt" IS NULL AND a."deletedAt" IS NULL
        ) AS "hasAuction",
        count(*) OVER()::int AS "totalCount"
      FROM classified_listings l
      LEFT JOIN classified_categories cat ON cat.slug=l."categorySlug"
      LEFT JOIN companies c ON c.id=l."companyId"
      LEFT JOIN users u ON u.id=l."sellerUserId"
      LEFT JOIN LATERAL (
        SELECT url FROM classified_listing_images
        WHERE "listingId"=l.id ORDER BY "sortOrder" ASC LIMIT 1
      ) img ON true
      WHERE ${filters.join(' AND ')}
      ORDER BY l."updatedAt" DESC
      LIMIT $${limitIndex}::int OFFSET $${offsetIndex}::int
    `, params);
        const total = Number(rows[0]?.totalCount || 0);
        return {
            items: rows.map(({ totalCount, ...row }) => row),
            pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        };
    }
    async listing(id) {
        await this.ensureSchema();
        const rows = await this.dataSource.query(`
      SELECT l.*,cat.name AS "categoryName",c.name AS "companyName",
             COALESCE(u."socialName",u."displayName",u."fullName",u.email,'Usuário') AS "sellerName",
             u.email AS "sellerEmail",
             COALESCE(img.images,'[]'::json) AS images
      FROM classified_listings l
      LEFT JOIN classified_categories cat ON cat.slug=l."categorySlug"
      LEFT JOIN companies c ON c.id=l."companyId"
      LEFT JOIN users u ON u.id=l."sellerUserId"
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object('id',id,'url',url,'sortOrder',"sortOrder",'isPrimary',"isPrimary") ORDER BY "sortOrder") AS images
        FROM classified_listing_images WHERE "listingId"=l.id
      ) img ON true
      WHERE l.id=$1::uuid LIMIT 1
    `, [id]);
        if (!rows[0])
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        return rows[0];
    }
    async updateListing(id, adminUserId, body) {
        await this.ensureSchema();
        const current = await this.listing(id);
        if (current.deletedAt)
            throw new common_1.BadRequestException('Este anúncio foi excluído e permanece somente para preservar o histórico.');
        const nextType = body.listingType === undefined ? String(current.listingType) : String(body.listingType || '').toUpperCase();
        const nextStatus = body.status === undefined ? String(current.status) : String(body.status || '').toUpperCase();
        if (!LISTING_TYPES.has(nextType))
            throw new common_1.BadRequestException('Tipo de anúncio inválido.');
        if (!LISTING_STATUSES.has(nextStatus))
            throw new common_1.BadRequestException('Status de anúncio inválido.');
        if (nextStatus === 'ARCHIVED')
            return this.archiveListing(id, adminUserId);
        const title = body.title === undefined ? current.title : String(body.title || '').trim().slice(0, 160);
        const description = body.description === undefined ? current.description : String(body.description || '').trim();
        const categorySlug = body.categorySlug === undefined ? current.categorySlug : String(body.categorySlug || '').trim().slice(0, 80);
        if (!title)
            throw new common_1.BadRequestException('O título não pode ficar vazio.');
        if (!description)
            throw new common_1.BadRequestException('A descrição não pode ficar vazia.');
        if (!categorySlug)
            throw new common_1.BadRequestException('A categoria não pode ficar vazia.');
        const category = await this.dataSource.query(`SELECT slug FROM classified_categories WHERE slug=$1::varchar AND "isActive"=true LIMIT 1`, [categorySlug]);
        if (!category[0])
            throw new common_1.BadRequestException('Categoria inválida ou inativa.');
        let price = current.price == null ? null : String(current.price);
        if (body.price !== undefined) {
            if (body.price === null || String(body.price).trim() === '')
                price = null;
            else {
                const numeric = Number(String(body.price).replace(',', '.'));
                if (!Number.isFinite(numeric) || numeric < 0)
                    throw new common_1.BadRequestException('Preço inválido.');
                price = numeric.toFixed(2);
            }
        }
        const city = body.city === undefined ? current.city : String(body.city || '').trim().slice(0, 120);
        const state = body.state === undefined ? current.state : String(body.state || '').trim().toUpperCase().slice(0, 2);
        if (!city || state.length !== 2)
            throw new common_1.BadRequestException('Informe cidade e UF válidas.');
        const moderationReason = body.moderationReason === undefined
            ? current.moderationReason
            : String(body.moderationReason || '').trim().slice(0, 2000) || null;
        const isFeatured = body.isFeatured === undefined ? Boolean(current.isFeatured) : body.isFeatured === true;
        await this.dataSource.query(`
      UPDATE classified_listings SET
        title=$2::varchar,
        description=$3::text,
        "categorySlug"=$4::varchar,
        "listingType"=$5::varchar,
        price=$6::numeric,
        city=$7::varchar,
        state=$8::varchar,
        status=$9::varchar,
        "moderationReason"=$10::text,
        "moderationReviewedAt"=now(),
        "isFeatured"=$11::boolean,
        "publishedAt"=CASE WHEN $9::varchar='PUBLISHED' THEN COALESCE("publishedAt",now()) ELSE "publishedAt" END,
        "archivedAt"=NULL,"archivedByUserId"=NULL,"archivedPreviousStatus"=NULL,
        "updatedAt"=now()
      WHERE id=$1::uuid
    `, [id, title, description, categorySlug, nextType, price, city, state, nextStatus, moderationReason, isFeatured]);
        if (nextStatus !== 'PUBLISHED') {
            await this.dataSource.query(`
        UPDATE classified_auctions SET status='CANCELED',"closedAt"=COALESCE("closedAt",now()),"updatedAt"=now()
        WHERE "listingId"=$1::uuid AND status IN ('SCHEDULED','OPEN') AND "deletedAt" IS NULL
      `, [id]).catch(() => undefined);
        }
        return this.listing(id);
    }
    async archiveListing(id, adminUserId) {
        await this.ensureSchema();
        const rows = await this.dataSource.query(`
      UPDATE classified_listings SET
        "archivedPreviousStatus"=CASE WHEN status<>'ARCHIVED' THEN status ELSE COALESCE("archivedPreviousStatus",'PAUSED') END,
        status='ARCHIVED',"archivedAt"=COALESCE("archivedAt",now()),"archivedByUserId"=$2::varchar,
        "moderationReviewedAt"=now(),"updatedAt"=now()
      WHERE id=$1::uuid AND "deletedAt" IS NULL RETURNING id
    `, [id, adminUserId]);
        if (!rows[0])
            throw new common_1.NotFoundException('Anúncio não encontrado ou já excluído.');
        await this.dataSource.query(`
      UPDATE classified_auctions SET
        "archivedPreviousStatus"=COALESCE("archivedPreviousStatus",status),
        status=CASE WHEN status IN ('SCHEDULED','OPEN') THEN 'CANCELED' ELSE status END,
        "closedAt"=CASE WHEN status IN ('SCHEDULED','OPEN') THEN COALESCE("closedAt",now()) ELSE "closedAt" END,
        "archivedAt"=COALESCE("archivedAt",now()),"archivedByUserId"=$2::varchar,"updatedAt"=now()
      WHERE "listingId"=$1::uuid AND "archivedAt" IS NULL AND "deletedAt" IS NULL
    `, [id, adminUserId]).catch(() => undefined);
        return this.listing(id);
    }
    async restoreListing(id) {
        await this.ensureSchema();
        const rows = await this.dataSource.query(`
      UPDATE classified_listings SET
        status=CASE
          WHEN "archivedPreviousStatus" IN ('DRAFT','PUBLISHED','PAUSED','SOLD','PENDING_REVIEW') THEN "archivedPreviousStatus"
          ELSE 'PAUSED'
        END,
        "archivedAt"=NULL,"archivedByUserId"=NULL,"archivedPreviousStatus"=NULL,"updatedAt"=now()
      WHERE id=$1::uuid AND status='ARCHIVED' AND "deletedAt" IS NULL RETURNING id
    `, [id]);
        if (!rows[0])
            throw new common_1.BadRequestException('Este anúncio não está arquivado, foi excluído ou não foi encontrado.');
        return this.listing(id);
    }
    async deleteListing(id, adminUserId) {
        await this.ensureSchema();
        const rows = await this.dataSource.query(`
      UPDATE classified_listings SET
        "archivedPreviousStatus"=CASE WHEN status<>'ARCHIVED' THEN status ELSE COALESCE("archivedPreviousStatus",'PAUSED') END,
        status='ARCHIVED',
        "archivedAt"=COALESCE("archivedAt",now()),
        "archivedByUserId"=COALESCE("archivedByUserId",$2::varchar),
        "deletedAt"=COALESCE("deletedAt",now()),
        "deletedByUserId"=COALESCE("deletedByUserId",$2::varchar),
        attributes=COALESCE(attributes,'{}'::jsonb) || jsonb_build_object('softDeleted',true,'softDeletedAt',now()),
        "updatedAt"=now()
      WHERE id=$1::uuid
      RETURNING id,title,"deletedAt"
    `, [id, adminUserId || null]);
        if (!rows[0])
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        await this.dataSource.query(`
      UPDATE classified_auctions SET
        "archivedPreviousStatus"=COALESCE("archivedPreviousStatus",status),
        status=CASE WHEN status IN ('SCHEDULED','OPEN') THEN 'CANCELED' ELSE status END,
        "closedAt"=CASE WHEN status IN ('SCHEDULED','OPEN') THEN COALESCE("closedAt",now()) ELSE "closedAt" END,
        "archivedAt"=COALESCE("archivedAt",now()),
        "archivedByUserId"=COALESCE("archivedByUserId",$2::varchar),
        "deletedAt"=COALESCE("deletedAt",now()),
        "deletedByUserId"=COALESCE("deletedByUserId",$2::varchar),
        "updatedAt"=now()
      WHERE "listingId"=$1::uuid AND "deletedAt" IS NULL
    `, [id, adminUserId || null]).catch(() => undefined);
        return { deleted: true, soft: true, id: rows[0].id, title: rows[0].title, deletedAt: rows[0].deletedAt };
    }
    async auctions(query) {
        await this.ensureSchema();
        const archived = String(query.archived || 'false').toLowerCase() === 'true';
        const statusRaw = String(query.status || 'ALL').toUpperCase();
        const q = String(query.q || '').trim().slice(0, 160);
        const page = Math.max(1, Number(query.page) || 1);
        const pageSize = Math.max(10, Math.min(100, Number(query.pageSize) || 30));
        const offset = (page - 1) * pageSize;
        const filters = [
            `a."deletedAt" IS NULL`,
            archived ? `a."archivedAt" IS NOT NULL` : `a."archivedAt" IS NULL`,
        ];
        const params = [];
        if (statusRaw !== 'ALL') {
            if (!AUCTION_STATUSES.has(statusRaw))
                throw new common_1.BadRequestException('Status de leilão inválido.');
            params.push(statusRaw);
            filters.push(`a.status=$${params.length}::varchar`);
        }
        if (q) {
            params.push(`%${q}%`);
            filters.push(`(l.title ILIKE $${params.length}::text OR c.name ILIKE $${params.length}::text)`);
        }
        params.push(pageSize, offset);
        const limitIndex = params.length - 1;
        const offsetIndex = params.length;
        const rows = await this.dataSource.query(`
      SELECT a.*,l.title,l.slug,l.status AS "listingStatus",l.price,l.city,l.state,c.name AS "companyName",
             img.url AS image,
             COALESCE(bids."bidCount",0)::int AS "bidCount",bids."currentBid",
             count(*) OVER()::int AS "totalCount"
      FROM classified_auctions a
      JOIN classified_listings l ON l.id=a."listingId"
      JOIN companies c ON c.id=a."companyId"
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS "bidCount",max(amount) AS "currentBid"
        FROM classified_auction_bids WHERE "auctionId"=a.id
      ) bids ON true
      LEFT JOIN LATERAL (
        SELECT url FROM classified_listing_images WHERE "listingId"=l.id ORDER BY "sortOrder" ASC LIMIT 1
      ) img ON true
      WHERE ${filters.join(' AND ')}
      ORDER BY a."updatedAt" DESC
      LIMIT $${limitIndex}::int OFFSET $${offsetIndex}::int
    `, params);
        const total = Number(rows[0]?.totalCount || 0);
        return {
            items: rows.map(({ totalCount, ...row }) => row),
            pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        };
    }
    async archiveAuction(id, adminUserId) {
        await this.ensureSchema();
        const rows = await this.dataSource.query(`
      UPDATE classified_auctions SET
        "archivedPreviousStatus"=COALESCE("archivedPreviousStatus",status),
        status=CASE WHEN status IN ('SCHEDULED','OPEN') THEN 'CANCELED' ELSE status END,
        "closedAt"=CASE WHEN status IN ('SCHEDULED','OPEN') THEN COALESCE("closedAt",now()) ELSE "closedAt" END,
        "archivedAt"=COALESCE("archivedAt",now()),"archivedByUserId"=$2::varchar,"updatedAt"=now()
      WHERE id=$1::uuid AND "deletedAt" IS NULL RETURNING *
    `, [id, adminUserId]);
        if (!rows[0])
            throw new common_1.NotFoundException('Leilão não encontrado ou já excluído.');
        return rows[0];
    }
    async restoreAuction(id) {
        await this.ensureSchema();
        const rows = await this.dataSource.query(`
      UPDATE classified_auctions SET "archivedAt"=NULL,"archivedByUserId"=NULL,"archivedPreviousStatus"=NULL,"updatedAt"=now()
      WHERE id=$1::uuid AND "archivedAt" IS NOT NULL AND "deletedAt" IS NULL RETURNING *
    `, [id]);
        if (!rows[0])
            throw new common_1.BadRequestException('Este leilão não está arquivado, foi excluído ou não foi encontrado.');
        return rows[0];
    }
    async cancelAuction(id) {
        await this.ensureSchema();
        const rows = await this.dataSource.query(`
      UPDATE classified_auctions SET status='CANCELED',"closedAt"=COALESCE("closedAt",now()),"updatedAt"=now()
      WHERE id=$1::uuid AND status IN ('SCHEDULED','OPEN') AND "archivedAt" IS NULL AND "deletedAt" IS NULL RETURNING *
    `, [id]);
        if (!rows[0])
            throw new common_1.BadRequestException('O leilão não está ativo ou não foi encontrado.');
        return rows[0];
    }
    async deleteAuction(id, adminUserId) {
        await this.ensureSchema();
        const rows = await this.dataSource.query(`
      UPDATE classified_auctions SET
        "archivedPreviousStatus"=COALESCE("archivedPreviousStatus",status),
        status=CASE WHEN status IN ('SCHEDULED','OPEN') THEN 'CANCELED' ELSE status END,
        "closedAt"=CASE WHEN status IN ('SCHEDULED','OPEN') THEN COALESCE("closedAt",now()) ELSE "closedAt" END,
        "archivedAt"=COALESCE("archivedAt",now()),
        "archivedByUserId"=COALESCE("archivedByUserId",$2::varchar),
        "deletedAt"=COALESCE("deletedAt",now()),
        "deletedByUserId"=COALESCE("deletedByUserId",$2::varchar),
        "updatedAt"=now()
      WHERE id=$1::uuid
      RETURNING id,"listingId","deletedAt"
    `, [id, adminUserId || null]);
        if (!rows[0])
            throw new common_1.NotFoundException('Leilão não encontrado.');
        return { deleted: true, soft: true, id: rows[0].id, listingId: rows[0].listingId, deletedAt: rows[0].deletedAt };
    }
    async ensureSchema() {
        await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "archivedByUserId" varchar NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "archivedPreviousStatus" varchar(24) NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "deletedByUserId" varchar NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "archivedByUserId" varchar NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "archivedPreviousStatus" varchar(24) NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL`).catch(() => undefined);
        await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "deletedByUserId" varchar NULL`).catch(() => undefined);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS classified_listings_admin_archived_idx ON classified_listings(status,"updatedAt" DESC)`).catch(() => undefined);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS classified_listings_deleted_idx ON classified_listings("deletedAt","updatedAt" DESC)`).catch(() => undefined);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS classified_auctions_admin_archived_idx ON classified_auctions("archivedAt","updatedAt" DESC)`).catch(() => undefined);
        await this.dataSource.query(`CREATE INDEX IF NOT EXISTS classified_auctions_deleted_idx ON classified_auctions("deletedAt","updatedAt" DESC)`).catch(() => undefined);
    }
};
exports.ClassifiedsCatalogAdminService = ClassifiedsCatalogAdminService;
exports.ClassifiedsCatalogAdminService = ClassifiedsCatalogAdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ClassifiedsCatalogAdminService);
//# sourceMappingURL=classifieds-catalog-admin.service.js.map