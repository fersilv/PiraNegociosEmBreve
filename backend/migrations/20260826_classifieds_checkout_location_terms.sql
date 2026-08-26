-- Classificados checkout online, termos versionados, entrega e localização privada.

ALTER TABLE classified_listings
  ADD COLUMN IF NOT EXISTS "deliveryModes" jsonb NOT NULL DEFAULT '["ARRANGE"]'::jsonb;

ALTER TABLE classified_orders
  ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar(120) NULL,
  ADD COLUMN IF NOT EXISTS "providerStatusDetail" varchar(160) NULL,
  ADD COLUMN IF NOT EXISTS "termsVersion" varchar(32) NULL,
  ADD COLUMN IF NOT EXISTS "stockReserved" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "expiresAt" timestamptz NULL;

CREATE UNIQUE INDEX IF NOT EXISTS classified_orders_idempotency_uq
  ON classified_orders("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

ALTER TABLE classified_orders DROP CONSTRAINT IF EXISTS classified_orders_fulfillment_check;
ALTER TABLE classified_orders
  ADD CONSTRAINT classified_orders_fulfillment_check
  CHECK ("fulfillmentMode" IN ('ARRANGE','PICKUP','DELIVERY'));

-- PKCE do OAuth de sellers. O verifier é criptografado com o mesmo cofre de pagamentos.
ALTER TABLE company_classified_payment_oauth_states
  ADD COLUMN IF NOT EXISTS "codeVerifierEncrypted" text NULL;

CREATE TABLE IF NOT EXISTS classified_marketplace_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "companyId" uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  scope varchar(32) NOT NULL,
  version varchar(32) NOT NULL,
  "identityKey" varchar(220) NOT NULL,
  metadata jsonb NULL,
  "acceptedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_marketplace_terms_scope_check
    CHECK (scope IN ('ONLINE_PAYMENT_BUYER','ONLINE_PAYMENT_SELLER'))
);

CREATE UNIQUE INDEX IF NOT EXISTS classified_marketplace_terms_acceptance_uq
  ON classified_marketplace_terms_acceptances("identityKey", scope, version);
CREATE INDEX IF NOT EXISTS classified_marketplace_terms_user_idx
  ON classified_marketplace_terms_acceptances("userId", "acceptedAt" DESC);
CREATE INDEX IF NOT EXISTS classified_marketplace_terms_company_idx
  ON classified_marketplace_terms_acceptances("companyId", "acceptedAt" DESC)
  WHERE "companyId" IS NOT NULL;

-- Endereço e coordenada exatos ficam fora de classified_listings para nunca
-- vazarem por hidratação pública do anúncio. A API pública usa apenas distância calculada.
CREATE TABLE IF NOT EXISTS classified_listing_private_locations (
  "listingId" uuid PRIMARY KEY REFERENCES classified_listings(id) ON DELETE CASCADE,
  address text NULL,
  "zipCode" varchar(20) NULL,
  latitude numeric(10,7) NULL,
  longitude numeric(10,7) NULL,
  source varchar(24) NOT NULL DEFAULT 'PROFILE',
  "updatedByUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_listing_private_location_source_check
    CHECK (source IN ('PROFILE','COMPANY_PROFILE','MANUAL','DEVICE')),
  CONSTRAINT classified_listing_private_lat_check
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT classified_listing_private_lng_check
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);
CREATE INDEX IF NOT EXISTS classified_listing_private_location_coords_idx
  ON classified_listing_private_locations(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Move dados de precisão que versões anteriores deixavam na própria entidade pública.
INSERT INTO classified_listing_private_locations
  ("listingId","zipCode",latitude,longitude,source,"updatedByUserId","createdAt","updatedAt")
SELECT id,"zipCode",latitude,longitude,'PROFILE',"sellerUserId",now(),now()
FROM classified_listings
WHERE "zipCode" IS NOT NULL OR latitude IS NOT NULL OR longitude IS NOT NULL
ON CONFLICT ("listingId") DO UPDATE SET
  "zipCode" = COALESCE(classified_listing_private_locations."zipCode", EXCLUDED."zipCode"),
  latitude = COALESCE(classified_listing_private_locations.latitude, EXCLUDED.latitude),
  longitude = COALESCE(classified_listing_private_locations.longitude, EXCLUDED.longitude),
  "updatedAt" = now();

UPDATE classified_listings
SET "zipCode" = NULL, latitude = NULL, longitude = NULL, "updatedAt" = now()
WHERE "zipCode" IS NOT NULL OR latitude IS NOT NULL OR longitude IS NOT NULL;

COMMENT ON TABLE classified_listing_private_locations IS
  'Exact seller location used only for proximity/fulfillment. Never expose raw address or coordinates in public classifieds APIs.';
COMMENT ON COLUMN classified_listings."deliveryModes" IS
  'Seller-declared fulfillment choices: ARRANGE, PICKUP and/or DELIVERY. Delivery pricing is intentionally not calculated yet.';
