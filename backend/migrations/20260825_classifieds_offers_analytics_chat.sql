CREATE TABLE IF NOT EXISTS classified_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" uuid NOT NULL,
  "buyerUserId" varchar NOT NULL,
  "buyerCompanyId" uuid NULL,
  "sellerUserId" varchar NOT NULL,
  "sellerCompanyId" uuid NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status varchar(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACCEPTED','REJECTED','EXPIRED','WITHDRAWN')),
  "expiresAt" timestamptz NOT NULL,
  "respondedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_offers_listing_fk FOREIGN KEY ("listingId") REFERENCES classified_listings(id) ON DELETE CASCADE,
  CONSTRAINT classified_offers_buyer_user_fk FOREIGN KEY ("buyerUserId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT classified_offers_seller_user_fk FOREIGN KEY ("sellerUserId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT classified_offers_buyer_company_fk FOREIGN KEY ("buyerCompanyId") REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT classified_offers_seller_company_fk FOREIGN KEY ("sellerCompanyId") REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS classified_offers_listing_idx ON classified_offers ("listingId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_offers_seller_user_idx ON classified_offers ("sellerUserId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_offers_seller_company_idx ON classified_offers ("sellerCompanyId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_offers_buyer_user_idx ON classified_offers ("buyerUserId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_offers_buyer_company_idx ON classified_offers ("buyerCompanyId", status, "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS classified_offer_pending_personal_uq
  ON classified_offers ("listingId", "buyerUserId")
  WHERE "buyerCompanyId" IS NULL AND status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS classified_offer_pending_business_uq
  ON classified_offers ("listingId", "buyerCompanyId")
  WHERE "buyerCompanyId" IS NOT NULL AND status = 'PENDING';

CREATE TABLE IF NOT EXISTS classified_conversation_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" uuid NOT NULL,
  "ownerKey" varchar(220) NOT NULL,
  "customName" varchar(160) NULL,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_conversation_preferences_conversation_fk
    FOREIGN KEY ("conversationId") REFERENCES classified_conversations(id) ON DELETE CASCADE,
  CONSTRAINT classified_conversation_preferences_owner_uq UNIQUE ("conversationId", "ownerKey")
);

CREATE INDEX IF NOT EXISTS classified_conversation_preferences_owner_idx
  ON classified_conversation_preferences ("ownerKey", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS classified_chat_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL,
  name varchar(80) NOT NULL,
  "colorKey" varchar(24) NOT NULL DEFAULT 'STONE',
  "isSystem" boolean NOT NULL DEFAULT false,
  "createdBy" varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_chat_labels_company_fk FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS classified_chat_labels_company_name_uq
  ON classified_chat_labels ("companyId", lower(name));

CREATE TABLE IF NOT EXISTS classified_listing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" uuid NOT NULL,
  "actorUserId" varchar NULL,
  "actorCompanyId" uuid NULL,
  "eventType" varchar(32) NOT NULL
    CHECK ("eventType" IN ('VIEW','FAVORITE','CHAT_START','OFFER','OFFER_ACCEPTED','OFFER_REJECTED','CONTACT_CLICK')),
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_listing_events_listing_fk FOREIGN KEY ("listingId") REFERENCES classified_listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS classified_listing_events_listing_idx
  ON classified_listing_events ("listingId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_listing_events_type_idx
  ON classified_listing_events ("eventType", "createdAt" DESC);

ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "moderationReason" text NULL;
ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "duplicateOfListingId" uuid NULL;
ALTER TABLE classified_listings ADD COLUMN IF NOT EXISTS "moderationReviewedAt" timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classified_listings_duplicate_fk'
  ) THEN
    ALTER TABLE classified_listings
      ADD CONSTRAINT classified_listings_duplicate_fk
      FOREIGN KEY ("duplicateOfListingId") REFERENCES classified_listings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS classified_listings_duplicate_idx
  ON classified_listings ("duplicateOfListingId") WHERE "duplicateOfListingId" IS NOT NULL;
