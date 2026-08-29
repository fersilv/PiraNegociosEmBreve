-- Administração central dos Classificados.
-- Arquivamento é reversível. Exclusão é soft delete para preservar compras, conversas,
-- pedidos, lances, liquidação e demais referências históricas.

ALTER TABLE classified_listings
  ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "archivedByUserId" varchar NULL,
  ADD COLUMN IF NOT EXISTS "archivedPreviousStatus" varchar(24) NULL,
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "deletedByUserId" varchar NULL;

UPDATE classified_listings
SET "archivedAt" = COALESCE("archivedAt", "updatedAt", now()),
    "archivedPreviousStatus" = COALESCE("archivedPreviousStatus", 'PAUSED')
WHERE status = 'ARCHIVED';

CREATE INDEX IF NOT EXISTS classified_listings_admin_archived_idx
  ON classified_listings(status, "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS classified_listings_deleted_idx
  ON classified_listings("deletedAt", "updatedAt" DESC);

ALTER TABLE classified_auctions
  ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "archivedByUserId" varchar NULL,
  ADD COLUMN IF NOT EXISTS "archivedPreviousStatus" varchar(24) NULL,
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "deletedByUserId" varchar NULL;

CREATE INDEX IF NOT EXISTS classified_auctions_admin_archived_idx
  ON classified_auctions("archivedAt", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS classified_auctions_deleted_idx
  ON classified_auctions("deletedAt", "updatedAt" DESC);

-- Produto comum pode ser vendido várias vezes e continua na vitrine.
-- Somente produtos explicitamente marcados como uniqueItem saem da vitrine após venda paga.
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

DROP TRIGGER IF EXISTS classified_unique_paid_order_listing_status ON classified_orders;
CREATE TRIGGER classified_unique_paid_order_listing_status
AFTER UPDATE OF "paymentStatus" ON classified_orders
FOR EACH ROW
EXECUTE FUNCTION pn_mark_unique_listing_sold_on_paid_order();

-- O fechamento de leilão atualmente pausa o item durante a reserva.
-- Este constraint trigger é deferido até o fim da transação e normaliza a vitrine:
-- item único vira SOLD; produto de catálogo volta a PUBLISHED.
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

DROP TRIGGER IF EXISTS classified_auction_sale_listing_status ON classified_auctions;
CREATE CONSTRAINT TRIGGER classified_auction_sale_listing_status
AFTER UPDATE ON classified_auctions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.status = 'ENDED' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION pn_normalize_listing_after_auction_sale();

COMMENT ON COLUMN classified_listings."archivedAt" IS 'Archive timestamp. Archived listings are excluded from operational reports but remain recoverable.';
COMMENT ON COLUMN classified_listings."deletedAt" IS 'Soft-delete timestamp. The row is retained to preserve orders, purchases, conversations and history.';
COMMENT ON COLUMN classified_auctions."archivedAt" IS 'Archive timestamp independent from auction settlement status.';
COMMENT ON COLUMN classified_auctions."deletedAt" IS 'Soft-delete timestamp. Auction history remains stored for bidders, winner and seller accounting.';
