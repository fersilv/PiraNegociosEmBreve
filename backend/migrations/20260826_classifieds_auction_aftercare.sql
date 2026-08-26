ALTER TABLE classified_auctions
  ADD COLUMN IF NOT EXISTS "settlementStatus" varchar(24) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "settlementUpdatedAt" timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classified_auctions_settlement_status_check'
  ) THEN
    ALTER TABLE classified_auctions
      ADD CONSTRAINT classified_auctions_settlement_status_check
      CHECK ("settlementStatus" IN ('PENDING','CONTACTED','AGREED','COMPLETED','CANCELED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS classified_auctions_listing_closed_idx
  ON classified_auctions("listingId", "closedAt" DESC);

CREATE INDEX IF NOT EXISTS classified_auctions_settlement_idx
  ON classified_auctions("settlementStatus", "updatedAt" DESC)
  WHERE status = 'ENDED' AND "winnerUserId" IS NOT NULL;

UPDATE classified_auctions
SET "settlementStatus" = CASE
  WHEN status = 'CANCELED' THEN 'CANCELED'
  ELSE COALESCE("settlementStatus", 'PENDING')
END,
"settlementUpdatedAt" = COALESCE("settlementUpdatedAt", "closedAt", "updatedAt")
WHERE status IN ('ENDED','CANCELED');

COMMENT ON COLUMN classified_auctions."settlementStatus" IS
  'Post-auction direct-negotiation lifecycle. Payment custody remains off-platform.';
