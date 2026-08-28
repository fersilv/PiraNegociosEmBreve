import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClassifiedsIdentityService } from './classifieds-identity.service';

@Injectable()
export class ClassifiedsLifecycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identities: ClassifiedsIdentityService,
  ) {}

  async archiveListing(uid: string, id: string) {
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
    if (!rows[0]) throw new NotFoundException('Anúncio não encontrado ou já excluído.');
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

  async restoreListing(uid: string, id: string) {
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
    if (!rows[0]) throw new BadRequestException('Este anúncio não está arquivado ou já foi excluído.');
    return rows[0];
  }

  async republishListing(uid: string, id: string) {
    await this.ensureSchema();
    const listing = await this.assertListingOwner(uid, id);
    if (listing.deletedAt) throw new BadRequestException('Um anúncio excluído não pode ser republicado.');
    if (listing.moderationReason && ['PAUSED','PENDING_REVIEW'].includes(String(listing.status))) {
      throw new BadRequestException('Este anúncio possui uma pendência de moderação e precisa ser revisado antes de voltar à vitrine.');
    }
    if (!listing.title || !listing.description || !listing.city || !listing.state) {
      throw new BadRequestException('Complete título, descrição e localização antes de republicar.');
    }
    if (String(listing.listingType) === 'PRODUCT' && listing.price == null) {
      throw new BadRequestException('Produtos precisam ter preço informado antes da publicação.');
    }
    const category = await this.dataSource.query(
      `SELECT slug FROM classified_categories WHERE slug=$1::varchar AND "isActive"=true LIMIT 1`,
      [listing.categorySlug],
    );
    if (!category[0]) throw new BadRequestException('A categoria deste anúncio está indisponível.');

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

  async markSold(uid: string, id: string) {
    await this.ensureSchema();
    const listing = await this.assertListingOwner(uid, id);
    if (String(listing.listingType) !== 'PRODUCT') throw new BadRequestException('Somente produtos podem ser marcados como vendidos.');
    if (listing.deletedAt || String(listing.status) === 'ARCHIVED') throw new BadRequestException('Este produto não está disponível para registrar venda.');
    if (String(listing.status) !== 'PUBLISHED') throw new BadRequestException('Publique o produto antes de registrar uma venda.');

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

  async setUniqueItem(uid: string, id: string, uniqueRaw: unknown) {
    await this.ensureSchema();
    const listing = await this.assertListingOwner(uid, id);
    if (String(listing.listingType) !== 'PRODUCT') throw new BadRequestException('A opção de item único é exclusiva de produtos.');
    if (listing.deletedAt) throw new BadRequestException('Este produto foi excluído.');
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

  async deleteListing(uid: string, id: string) {
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
    if (!rows[0]) throw new NotFoundException('Anúncio não encontrado.');
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

  async archiveAuction(uid: string, id: string) {
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
    if (!rows[0]) throw new NotFoundException('Leilão não encontrado ou já excluído.');
    return rows[0];
  }

  async restoreAuction(uid: string, id: string) {
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
    if (!rows[0]) throw new BadRequestException('Este leilão não está arquivado ou já foi excluído.');
    return rows[0];
  }

  async deleteAuction(uid: string, id: string) {
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
    if (!rows[0]) throw new NotFoundException('Leilão não encontrado.');
    return { deleted: true, soft: true, ...rows[0] };
  }

  private async assertListingOwner(uid: string, id: string) {
    const [identity, rows] = await Promise.all([
      this.identities.active(uid),
      this.dataSource.query(`SELECT * FROM classified_listings WHERE id=$1::uuid LIMIT 1`, [id]),
    ]);
    const listing = rows[0];
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');
    const allowed = identity.type === 'COMPANY'
      ? listing.companyId === identity.company!.id
      : !listing.companyId && listing.sellerUserId === uid;
    if (!allowed) throw new ForbiddenException('Este anúncio pertence a outra identidade.');
    return listing;
  }

  private async assertAuctionOwner(uid: string, id: string) {
    const identity = await this.identities.active(uid);
    if (identity.type !== 'COMPANY') throw new ForbiddenException('Somente a empresa anunciante pode administrar este leilão.');
    const rows = await this.dataSource.query(`SELECT * FROM classified_auctions WHERE id=$1::uuid LIMIT 1`, [id]);
    const auction = rows[0];
    if (!auction) throw new NotFoundException('Leilão não encontrado.');
    if (auction.companyId !== identity.company!.id) throw new ForbiddenException('Este leilão pertence a outra empresa.');
    return auction;
  }

  private async ensureSchema() {
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
}
