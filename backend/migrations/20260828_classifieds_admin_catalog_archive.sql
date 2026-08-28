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

COMMENT ON COLUMN classified_listings."archivedAt" IS 'Archive timestamp. Archived listings are excluded from operational reports but remain recoverable.';
COMMENT ON COLUMN classified_listings."deletedAt" IS 'Soft-delete timestamp. The row is retained to preserve orders, purchases, conversations and history.';
COMMENT ON COLUMN classified_auctions."archivedAt" IS 'Archive timestamp independent from auction settlement status.';
COMMENT ON COLUMN classified_auctions."deletedAt" IS 'Soft-delete timestamp. Auction history remains stored for bidders, winner and seller accounting.';
