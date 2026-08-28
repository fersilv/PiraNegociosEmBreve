import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ClassifiedsListingLifecycleSchemaService implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    void this.ensure().catch(() => undefined);
  }

  async ensure() {
    await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "deletedByUserId" varchar NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL`).catch(() => undefined);
    await this.dataSource.query(`ALTER TABLE classified_auctions ADD COLUMN IF NOT EXISTS "deletedByUserId" varchar NULL`).catch(() => undefined);

    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION pn_mark_unique_listing_sold_on_paid_order()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."paymentStatus" = 'APPROVED'
           AND COALESCE(OLD."paymentStatus", '') <> 'APPROVED' THEN
          UPDATE classified_listings
          SET status = 'SOLD', "updatedAt" = now()
          WHERE id = NEW."listingId"
            AND status = 'PUBLISHED'
            AND lower(COALESCE(attributes->>'uniqueItem','false')) = 'true';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `).catch(() => undefined);

    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'classified_unique_paid_order_listing_status'
        ) THEN
          CREATE TRIGGER classified_unique_paid_order_listing_status
          AFTER UPDATE OF "paymentStatus" ON classified_orders
          FOR EACH ROW
          EXECUTE FUNCTION pn_mark_unique_listing_sold_on_paid_order();
        END IF;
      END $$;
    `).catch(() => undefined);

    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION pn_normalize_listing_after_auction_sale()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.status = 'ENDED'
           AND OLD.status IS DISTINCT FROM NEW.status
           AND NEW."winningBidId" IS NOT NULL THEN
          UPDATE classified_listings
          SET status = CASE
                WHEN lower(COALESCE(attributes->>'uniqueItem','false')) = 'true' THEN 'SOLD'
                ELSE 'PUBLISHED'
              END,
              "updatedAt" = now()
          WHERE id = NEW."listingId"
            AND status IN ('PUBLISHED','PAUSED','SOLD');
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `).catch(() => undefined);

    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'classified_auction_sale_listing_status'
        ) THEN
          CREATE CONSTRAINT TRIGGER classified_auction_sale_listing_status
          AFTER UPDATE ON classified_auctions
          DEFERRABLE INITIALLY DEFERRED
          FOR EACH ROW
          WHEN (NEW.status = 'ENDED' AND OLD.status IS DISTINCT FROM NEW.status)
          EXECUTE FUNCTION pn_normalize_listing_after_auction_sale();
        END IF;
      END $$;
    `).catch(() => undefined);
  }
}
