-- Administração central dos Classificados.
-- Arquivamento é reversível e separado da exclusão permanente.

ALTER TABLE classified_listings
  ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "archivedByUserId" varchar NULL,
  ADD COLUMN IF NOT EXISTS "archivedPreviousStatus" varchar(24) NULL;

UPDATE classified_listings
SET "archivedAt" = COALESCE("archivedAt", "updatedAt", now()),
    "archivedPreviousStatus" = COALESCE("archivedPreviousStatus", 'PAUSED')
WHERE status = 'ARCHIVED';

CREATE INDEX IF NOT EXISTS classified_listings_admin_archived_idx
  ON classified_listings(status, "updatedAt" DESC);

ALTER TABLE classified_auctions
  ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "archivedByUserId" varchar NULL,
  ADD COLUMN IF NOT EXISTS "archivedPreviousStatus" varchar(24) NULL;

CREATE INDEX IF NOT EXISTS classified_auctions_admin_archived_idx
  ON classified_auctions("archivedAt", "updatedAt" DESC);

COMMENT ON COLUMN classified_listings."archivedAt" IS 'Archive timestamp. Archived listings are excluded from operational reports but remain recoverable.';
COMMENT ON COLUMN classified_auctions."archivedAt" IS 'Archive timestamp independent from auction settlement status.';
