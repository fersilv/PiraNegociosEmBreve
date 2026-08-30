import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CompanyMcpProductLifecycleService {
  constructor(private readonly dataSource: DataSource) {}

  async markSold(companyId: string, id: string) {
    await this.ensureSchema();
    const product = await this.requireProduct(companyId, id);
    if (product.deletedAt || String(product.status) === 'ARCHIVED') {
      throw new BadRequestException('Este produto não está disponível para registrar venda.');
    }
    if (String(product.status) !== 'PUBLISHED') {
      throw new BadRequestException('Publique o produto antes de registrar uma venda.');
    }

    const unique = product.attributes?.uniqueItem === true;
    const rows = await this.dataSource.query(
      `UPDATE classified_listings SET
         status=CASE WHEN COALESCE((attributes->>'uniqueItem')::boolean,false) THEN 'SOLD' ELSE 'PUBLISHED' END,
         attributes=COALESCE(attributes,'{}'::jsonb) || jsonb_build_object(
           'lastSoldAt',now(),
           'salesMarkedCount',COALESCE(NULLIF(attributes->>'salesMarkedCount','')::int,0)+1
         ),
         "updatedAt"=now()
       WHERE id=$1::uuid AND "companyId"=$2::uuid AND "listingType"='PRODUCT' AND "deletedAt" IS NULL
       RETURNING *`,
      [id, companyId],
    );
    if (!rows[0]) throw new NotFoundException('Produto não encontrado para a empresa conectada.');
    return {
      ...rows[0],
      uniqueItem: unique,
      remainedPublished: !unique,
      message: unique
        ? 'Venda registrada. Como é item único, o produto saiu da vitrine.'
        : 'Venda registrada. O produto continua publicado porque não está marcado como item único.',
    };
  }

  async archive(companyId: string, id: string) {
    await this.ensureSchema();
    const product = await this.requireProduct(companyId, id);
    const actorId = String(product.sellerUserId || '').trim() || null;
    const rows = await this.dataSource.query(
      `UPDATE classified_listings SET
         "archivedPreviousStatus"=CASE
           WHEN status<>'ARCHIVED' THEN status
           ELSE COALESCE("archivedPreviousStatus",'PAUSED')
         END,
         status='ARCHIVED',
         "archivedAt"=COALESCE("archivedAt",now()),
         "archivedByUserId"=COALESCE("archivedByUserId",$3::varchar),
         "updatedAt"=now()
       WHERE id=$1::uuid AND "companyId"=$2::uuid AND "listingType"='PRODUCT' AND "deletedAt" IS NULL
       RETURNING *`,
      [id, companyId, actorId],
    );
    if (!rows[0]) throw new NotFoundException('Produto não encontrado ou já excluído.');

    await this.dataSource.query(
      `UPDATE classified_auctions SET
         "archivedPreviousStatus"=COALESCE("archivedPreviousStatus",status),
         status=CASE WHEN status IN ('SCHEDULED','OPEN') THEN 'CANCELED' ELSE status END,
         "closedAt"=CASE WHEN status IN ('SCHEDULED','OPEN') THEN COALESCE("closedAt",now()) ELSE "closedAt" END,
         "archivedAt"=COALESCE("archivedAt",now()),
         "archivedByUserId"=COALESCE("archivedByUserId",$3::varchar),
         "updatedAt"=now()
       WHERE "listingId"=$1::uuid AND "companyId"=$2::uuid AND "deletedAt" IS NULL`,
      [id, companyId, actorId],
    ).catch(() => undefined);
    return rows[0];
  }

  private async requireProduct(companyId: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM classified_listings
       WHERE id=$1::uuid AND "companyId"=$2::uuid AND "listingType"='PRODUCT'
       LIMIT 1`,
      [id, companyId],
    );
    if (!rows[0]) throw new NotFoundException('Produto não encontrado para a empresa conectada.');
    return rows[0];
  }

  private async ensureSchema() {
    await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "archivedByUserId" varchar NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "archivedPreviousStatus" varchar(24) NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "archivedByUserId" varchar NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "archivedPreviousStatus" varchar(24) NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL`).catch(() => undefined);
  }
}
