-- Leilões: repasse opcional da taxa ao arrematante, preferências de recebimento
-- e avaliações verificadas com publicação anônima após 7 dias.

ALTER TABLE classified_auctions
  ADD COLUMN IF NOT EXISTS "auctionFeePayer" varchar(16) NOT NULL DEFAULT 'SELLER',
  ADD COLUMN IF NOT EXISTS "auctionFeeRateBps" integer NULL,
  ADD COLUMN IF NOT EXISTS "auctionFeeMinimumCents" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "auctionFeeMaximumCents" integer NULL,
  ADD COLUMN IF NOT EXISTS "auctionFeeSource" varchar(24) NULL,
  ADD COLUMN IF NOT EXISTS "paymentMethods" jsonb NOT NULL DEFAULT '["PIX","CARD"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "cardMaxInstallments" integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "pickupAddressSnapshot" text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classified_auctions_fee_payer_check') THEN
    ALTER TABLE classified_auctions ADD CONSTRAINT classified_auctions_fee_payer_check
      CHECK ("auctionFeePayer" IN ('SELLER','BUYER'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classified_auctions_fee_snapshot_check') THEN
    ALTER TABLE classified_auctions ADD CONSTRAINT classified_auctions_fee_snapshot_check
      CHECK (
        ("auctionFeeRateBps" IS NULL OR "auctionFeeRateBps" BETWEEN 0 AND 10000)
        AND "auctionFeeMinimumCents" >= 0
        AND ("auctionFeeMaximumCents" IS NULL OR "auctionFeeMaximumCents" >= "auctionFeeMinimumCents")
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classified_auctions_card_installments_check') THEN
    ALTER TABLE classified_auctions ADD CONSTRAINT classified_auctions_card_installments_check
      CHECK ("cardMaxInstallments" BETWEEN 1 AND 24);
  END IF;
END $$;

-- Preferências comerciais da empresa. O Mercado Pago segue sendo a autoridade
-- sobre a capacidade técnica real da conta; aqui a empresa define o que deseja
-- oferecer dentro do PiraNegócios.
CREATE TABLE IF NOT EXISTS company_classified_receipt_preferences (
  "companyId" uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  provider varchar(24) NOT NULL DEFAULT 'MERCADO_PAGO',
  "pixEnabled" boolean NOT NULL DEFAULT true,
  "cardEnabled" boolean NOT NULL DEFAULT true,
  "cardMaxInstallments" integer NOT NULL DEFAULT 12,
  "auctionFeePayerDefault" varchar(16) NOT NULL DEFAULT 'SELLER',
  "pickupEnabled" boolean NOT NULL DEFAULT true,
  "deliveryEnabled" boolean NOT NULL DEFAULT false,
  "arrangeEnabled" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_classified_receipt_provider_check CHECK (provider IN ('MERCADO_PAGO','EFI')),
  CONSTRAINT company_classified_receipt_card_installments_check CHECK ("cardMaxInstallments" BETWEEN 1 AND 24),
  CONSTRAINT company_classified_receipt_fee_payer_check CHECK ("auctionFeePayerDefault" IN ('SELLER','BUYER')),
  CONSTRAINT company_classified_receipt_method_check CHECK ("pixEnabled" OR "cardEnabled")
);

-- Avaliação verificada. A identidade do avaliador nunca faz parte da resposta pública.
-- A avaliação só pode aparecer quando status=APPROVED e publishAt <= now().
CREATE TABLE IF NOT EXISTS classified_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES classified_orders(id) ON DELETE RESTRICT,
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "buyerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "productRating" smallint NULL,
  "serviceRating" smallint NULL,
  "companyRating" smallint NULL,
  comment text NULL,
  "photoUrls" jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'PENDING_AI',
  "moderationReason" text NULL,
  "aiProvider" varchar(32) NULL,
  "aiModel" varchar(120) NULL,
  "aiCheckedAt" timestamptz NULL,
  "submittedAt" timestamptz NOT NULL DEFAULT now(),
  "approvedAt" timestamptz NULL,
  "rejectedAt" timestamptz NULL,
  "publishAt" timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_reviews_order_unique UNIQUE ("orderId"),
  CONSTRAINT classified_reviews_status_check CHECK (status IN ('PENDING_AI','PENDING_MANUAL','APPROVED','REJECTED')),
  CONSTRAINT classified_reviews_product_rating_check CHECK ("productRating" IS NULL OR "productRating" BETWEEN 1 AND 5),
  CONSTRAINT classified_reviews_service_rating_check CHECK ("serviceRating" IS NULL OR "serviceRating" BETWEEN 1 AND 5),
  CONSTRAINT classified_reviews_company_rating_check CHECK ("companyRating" IS NULL OR "companyRating" BETWEEN 1 AND 5),
  CONSTRAINT classified_reviews_has_rating_check CHECK (
    "productRating" IS NOT NULL OR "serviceRating" IS NOT NULL OR "companyRating" IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS classified_reviews_listing_public_idx
  ON classified_reviews("listingId","publishAt") WHERE status='APPROVED';
CREATE INDEX IF NOT EXISTS classified_reviews_company_public_idx
  ON classified_reviews("companyId","publishAt") WHERE status='APPROVED';
CREATE INDEX IF NOT EXISTS classified_reviews_buyer_idx
  ON classified_reviews("buyerUserId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_reviews_moderation_idx
  ON classified_reviews(status,"createdAt") WHERE status IN ('PENDING_AI','PENDING_MANUAL');

COMMENT ON COLUMN classified_auctions."auctionFeePayer" IS 'SELLER absorbs PiraNegocios auction fee; BUYER pays auction amount + displayed fee. Delivery fee never enters auction fee base.';
COMMENT ON TABLE company_classified_receipt_preferences IS 'Company commercial payment preferences inside PiraNegocios. Provider account capabilities remain authoritative.';
COMMENT ON TABLE classified_reviews IS 'Verified-purchase anonymous public reviews. Reviewer identity is private; approved reviews become public no sooner than 7 days after submission.';
