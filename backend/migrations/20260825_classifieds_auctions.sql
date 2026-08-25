CREATE TABLE IF NOT EXISTS classified_auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE CASCADE,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "sellerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL DEFAULT 'OPEN',
  "startPrice" numeric(12,2) NOT NULL,
  "minIncrement" numeric(12,2) NOT NULL DEFAULT 1.00,
  "startsAt" timestamptz NOT NULL DEFAULT now(),
  "endsAt" timestamptz NOT NULL,
  "winnerUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "winnerCompanyId" uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  "winningBidId" uuid NULL,
  "finalAmount" numeric(12,2) NULL,
  "closedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_auctions_status_check CHECK (status IN ('OPEN','ENDED','CANCELED')),
  CONSTRAINT classified_auctions_start_price_check CHECK ("startPrice" > 0),
  CONSTRAINT classified_auctions_increment_check CHECK ("minIncrement" > 0),
  CONSTRAINT classified_auctions_period_check CHECK ("endsAt" > "startsAt")
);

CREATE INDEX IF NOT EXISTS classified_auctions_status_ends_idx
  ON classified_auctions(status, "endsAt");
CREATE INDEX IF NOT EXISTS classified_auctions_company_idx
  ON classified_auctions("companyId", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS classified_auctions_one_active_per_listing
  ON classified_auctions("listingId") WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS classified_auction_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "auctionId" uuid NOT NULL REFERENCES classified_auctions(id) ON DELETE CASCADE,
  "bidderUserId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "bidderCompanyId" uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_auction_bids_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS classified_auction_bids_rank_idx
  ON classified_auction_bids("auctionId", amount DESC, "createdAt" ASC);
CREATE INDEX IF NOT EXISTS classified_auction_bids_bidder_idx
  ON classified_auction_bids("bidderUserId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classified_auctions_winning_bid_fk'
  ) THEN
    ALTER TABLE classified_auctions
      ADD CONSTRAINT classified_auctions_winning_bid_fk
      FOREIGN KEY ("winningBidId") REFERENCES classified_auction_bids(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION ensure_classified_auction_winner_conversation()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'ENDED'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW."winnerUserId" IS NOT NULL THEN
    INSERT INTO classified_conversations
      ("listingId","buyerUserId","buyerCompanyId","sellerUserId","sellerCompanyId","buyerLastReadAt","sellerLastReadAt","lastMessageAt")
    VALUES
      (NEW."listingId", NEW."winnerUserId", NEW."winnerCompanyId", NEW."sellerUserId", NEW."companyId", now(), NULL, NULL)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classified_auction_winner_conversation ON classified_auctions;
CREATE TRIGGER trg_classified_auction_winner_conversation
AFTER UPDATE OF status, "winnerUserId", "winnerCompanyId" ON classified_auctions
FOR EACH ROW EXECUTE FUNCTION ensure_classified_auction_winner_conversation();

COMMENT ON TABLE classified_auctions IS 'Classificados V1 auctions. Payment/custody is intentionally off-platform; winner and seller negotiate settlement directly.';
