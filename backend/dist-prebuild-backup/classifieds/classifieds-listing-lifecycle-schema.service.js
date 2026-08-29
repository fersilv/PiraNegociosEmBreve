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
exports.ClassifiedsListingLifecycleSchemaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let ClassifiedsListingLifecycleSchemaService = class ClassifiedsListingLifecycleSchemaService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
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
};
exports.ClassifiedsListingLifecycleSchemaService = ClassifiedsListingLifecycleSchemaService;
exports.ClassifiedsListingLifecycleSchemaService = ClassifiedsListingLifecycleSchemaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ClassifiedsListingLifecycleSchemaService);
//# sourceMappingURL=classifieds-listing-lifecycle-schema.service.js.map