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
exports.ClassifiedsLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const classifieds_identity_service_1 = require("./classifieds-identity.service");
let ClassifiedsLifecycleService = class ClassifiedsLifecycleService {
    dataSource;
    identities;
    constructor(dataSource, identities) {
        this.dataSource = dataSource;
        this.identities = identities;
    }
    async archiveListing(uid, id) {
        await this.ensureSchema();
        await this.assertListingOwner(uid, id);
        const rows = await this.dataSource.query(`
      UPDATE classified_listings SET
        "archivedPreviousStatus"=CASE WHEN status<>'ARCHIVED' THEN status ELSE COALESCE("archivedPreviousStatus",'PAUSED') END,
        status='ARCHIVED',
        "archivedAt"=COALESCE("archivedAt",now()),
        "archivedByUserId"=$2::varchar,
        "updatedAt"=now()
      WHERE id=$1::uuid AND "deletedAt" IS NULL
      RETURNING *
    `, [id, uid]);
        if (!rows[0])
            throw new common_1.NotFoundException('Anúncio não encontrado ou já excluído.');
        await this.dataSource.query(`
      UPDATE classified_auctions SET
        "archivedPreviousStatus"=COALESCE("archivedPreviousStatus",status),
        status=CASE WHEN status IN ('SCHEDULED','OPEN') THEN 'CANCELED' ELSE status END,
        "closedAt"=CASE WHEN status IN ('SCHEDULED','OPEN') THEN COALESCE("closedAt",now()) ELSE "closedAt" END,
        "archivedAt"=COALESCE("archivedAt",now()),
        "archivedByUserId"=$2::varchar,
        "updatedAt"=now()
      WHERE "listingId"=$1::uuid AND "deletedAt" IS NULL
    `, [id, uid]).catch(() => undefined);
        return rows[0];
    }
    async restoreListing(uid, id) {
        await this.ensureSchema();
        await this.assertListingOwner(uid, id);
        const rows = await this.dataSource.query(`
      UPDATE classified_listings SET
        status=CASE
          WHEN "archivedPreviousStatus" IN ('DRAFT','PUBLISHED','PAUSED','SOLD','PENDING_REVIEW') THEN "archivedPreviousStatus"
          ELSE 'PAUSED'
        END,
        "archivedAt"=NULL,
        "archivedByUserId"=NULL,
        "archivedPreviousStatus"=NULL,
        "updatedAt"=now()
      WHERE id=$1::uuid AND status='ARCHIVED' AND "deletedAt" IS NULL
      RETURNING *
    `, [id]);
        if (!rows[0])
            throw new common_1.BadRequestException('Este anúncio não está arquivado ou já foi excluído.');
        return rows[0];
    }
    async republishListing(uid, id) {
        await this.ensureSchema();
        const listing = await this.assertListingOwner(uid, id);
        if (listing.deletedAt)
            throw new common_1.BadRequestException('Um anúncio excluído não pode ser republicado.');
        if (String(listing.status) === 'PENDING_REVIEW' || String(listing.archivedPreviousStatus || '') === 'PENDING_REVIEW') {
            throw new common_1.BadRequestException('Este anúncio está em revisão e precisa ser liberado pela moderação antes de voltar à vitrine.');
        }
        if (listing.moderationReason && (String(listing.status) === 'PAUSED' || String(listing.archivedPreviousStatus || '') === 'PAUSED')) {
            throw new common_1.BadRequestException('Este anúncio possui uma pendência de moderação e precisa ser revisado antes de voltar à vitrine.');
        }
        if (!listing.title || !listing.description || !listing.city || !listing.state) {
            throw new common_1.BadRequestException('Complete título, descrição e localização antes de republicar.');
        }
        if (String(listing.listingType) === 'PRODUCT' && listing.price == null) {
            throw new common_1.BadRequestException('Produtos precisam ter preço informado antes da publicação.');
        }
        const category = await this.dataSource.query(`SELECT slug FROM classified_categories WHERE slug=$1::varchar AND "isActive"=true LIMIT 1`, [listing.categorySlug]);
        if (!category[0])
            throw new common_1.BadRequestException('A categoria deste anúncio está indisponível.');
        const rows = await this.dataSource.query(`
      UPDATE classified_listings SET
        status='PUBLISHED',
        "publishedAt"=COALESCE("publishedAt",now()),
        "archivedAt"=NULL,
        "archivedByUserId"=NULL,
        "archivedPreviousStatus"=NULL,
        attributes=(COALESCE(attributes,'{}'::jsonb) - 'softDeleted' - 'softDeletedAt'),
        "updatedAt"=now()
      WHERE id=$1::uuid AND "deletedAt" IS NULL
      RETURNING *
    `, [id]);
        return rows[0];
    }
    async markSold(uid, id) {
        await this.ensureSchema();
        const listing = await this.assertListingOwner(uid, id);
        if (String(listing.listingType) !== 'PRODUCT')
            throw new common_1.BadRequestException('Somente produtos podem ser marcados como vendidos.');
        if (listing.deletedAt || String(listing.status) === 'ARCHIVED')
            throw new common_1.BadRequestException('Este produto não está disponível para registrar venda.');
        if (String(listing.status) !== 'PUBLISHED')
            throw new common_1.BadRequestException('Publique o produto antes de registrar uma venda.');
        const unique = listing.attributes?.uniqueItem === true;
        const rows = await this.dataSource.query(`
      UPDATE classified_listings SET
        status=CASE WHEN COALESCE((attributes->>'uniqueItem')::boolean,false) THEN 'SOLD' ELSE 'PUBLISHED' END,
        attributes=COALESCE(attributes,'{}'::jsonb) || jsonb_build_object(
          'lastSoldAt',now(),
          'salesMarkedCount',COALESCE(NULLIF(attributes->>'salesMarkedCount','')::int,0)+1
        ),
        "updatedAt"=now()
      WHERE id=$1::uuid AND "deletedAt" IS NULL
      RETURNING *
    `, [id]);
        return {
            ...rows[0],
            uniqueItem: unique,
            remainedPublished: !unique,
            message: unique
                ? 'Venda registrada. Como é item único, o anúncio saiu da vitrine.'
                : 'Venda registrada. O anúncio continua publicado porque não está marcado como item único.',
        };
    }
    async setUniqueItem(uid, id, uniqueRaw) {
        await this.ensureSchema();
        const listing = await this.assertListingOwner(uid, id);
        if (String(listing.listingType) !== 'PRODUCT')
            throw new common_1.BadRequestException('A opção de item único é exclusiva de produtos.');
        if (listing.deletedAt)
            throw new common_1.BadRequestException('Este produto foi excluído.');
        const unique = uniqueRaw === true;
        const rows = await this.dataSource.query(`
      UPDATE classified_listings SET
        attributes=COALESCE(attributes,'{}'::jsonb) || jsonb_build_object('uniqueItem',$2::boolean),
        "updatedAt"=now()
      WHERE id=$1::uuid
      RETURNING *
    `, [id, unique]);
        return rows[0];
    }
    async deleteListing(uid, id) {
        await this.ensureSchema();
        await this.assertListingOwner(uid, id);
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
    `, [id, uid]);
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
    `, [id, uid]).catch(() => undefined);
        return { deleted: true, soft: true, ...rows[0] };
    }
    async archiveAuction(uid, id) {
        await this.ensureSchema();
        await this.assertAuctionOwner(uid, id);
        const rows = await this.dataSource.query(`
      UPDATE classified_auctions SET
        "archivedPreviousStatus"=COALESCE("archivedPreviousStatus",status),
        status=CASE WHEN status IN ('SCHEDULED','OPEN') THEN 'CANCELED' ELSE status END,
        "closedAt"=CASE WHEN status IN ('SCHEDULED','OPEN') THEN COALESCE("closedAt",now()) ELSE "closedAt" END,
        "archivedAt"=COALESCE("archivedAt",now()),
        "archivedByUserId"=$2::varchar,
        "updatedAt"=now()
      WHERE id=$1::uuid AND "deletedAt" IS NULL
      RETURNING *
    `, [id, uid]);
        if (!rows[0])
            throw new common_1.NotFoundException('Leilão não encontrado ou já excluído.');
        return rows[0];
    }
    async restoreAuction(uid, id) {
        await this.ensureSchema();
        await this.assertAuctionOwner(uid, id);
        const rows = await this.dataSource.query(`
      UPDATE classified_auctions SET
        "archivedAt"=NULL,
        "archivedByUserId"=NULL,
        "archivedPreviousStatus"=NULL,
        "updatedAt"=now()
      WHERE id=$1::uuid AND "archivedAt" IS NOT NULL AND "deletedAt" IS NULL
      RETURNING *
    `, [id]);
        if (!rows[0])
            throw new common_1.BadRequestException('Este leilão não está arquivado ou já foi excluído.');
        return rows[0];
    }
    async deleteAuction(uid, id) {
        await this.ensureSchema();
        await this.assertAuctionOwner(uid, id);
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
    `, [id, uid]);
        if (!rows[0])
            throw new common_1.NotFoundException('Leilão não encontrado.');
        return { deleted: true, soft: true, ...rows[0] };
    }
    async assertListingOwner(uid, id) {
        const [identity, rows] = await Promise.all([
            this.identities.active(uid),
            this.dataSource.query(`SELECT * FROM classified_listings WHERE id=$1::uuid LIMIT 1`, [id]),
        ]);
        const listing = rows[0];
        if (!listing)
            throw new common_1.NotFoundException('Anúncio não encontrado.');
        const allowed = identity.type === 'COMPANY'
            ? listing.companyId === identity.company.id
            : !listing.companyId && listing.sellerUserId === uid;
        if (!allowed)
            throw new common_1.ForbiddenException('Este anúncio pertence a outra identidade.');
        return listing;
    }
    async assertAuctionOwner(uid, id) {
        const identity = await this.identities.active(uid);
        if (identity.type !== 'COMPANY')
            throw new common_1.ForbiddenException('Somente a empresa anunciante pode administrar este leilão.');
        const rows = await this.dataSource.query(`SELECT * FROM classified_auctions WHERE id=$1::uuid LIMIT 1`, [id]);
        const auction = rows[0];
        if (!auction)
            throw new common_1.NotFoundException('Leilão não encontrado.');
        if (auction.companyId !== identity.company.id)
            throw new common_1.ForbiddenException('Este leilão pertence a outra empresa.');
        return auction;
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
    }
};
exports.ClassifiedsLifecycleService = ClassifiedsLifecycleService;
exports.ClassifiedsLifecycleService = ClassifiedsLifecycleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        classifieds_identity_service_1.ClassifiedsIdentityService])
], ClassifiedsLifecycleService);
//# sourceMappingURL=classifieds-lifecycle.service.js.map