CREATE TABLE IF NOT EXISTS pdv_integrations (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  "connectedByUserId" varchar NOT NULL,
  "pdvBaseUrl" text NOT NULL,
  "clientId" varchar NOT NULL,
  "accessTokenEncrypted" text NOT NULL,
  "refreshTokenEncrypted" text NOT NULL,
  "accessExpiresAt" timestamptz NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{"automaticSync":true,"importAllProducts":true,"visibleByDefault":true,"syncPrice":true,"syncStock":true,"defaultCategorySlug":"outros"}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'CONNECTED',
  "lastManualSyncAt" timestamptz,
  "lastAutoSyncAt" timestamptz,
  "lastSalesSyncAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pdv_oauth_states (
  id uuid PRIMARY KEY,
  "stateHash" varchar NOT NULL UNIQUE,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "userId" varchar NOT NULL,
  "pdvBaseUrl" text NOT NULL,
  "clientId" varchar NOT NULL,
  "codeVerifierEncrypted" text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expiresAt" timestamptz NOT NULL,
  "usedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdv_oauth_states_company ON pdv_oauth_states("companyId", "expiresAt");

CREATE TABLE IF NOT EXISTS pdv_product_links (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "pdvProductId" varchar NOT NULL,
  "listingId" uuid REFERENCES classified_listings(id) ON DELETE SET NULL,
  "syncEnabled" boolean NOT NULL DEFAULT true,
  visible boolean NOT NULL DEFAULT true,
  "syncPrice" boolean NOT NULL DEFAULT true,
  "syncStock" boolean NOT NULL DEFAULT true,
  "remoteSnapshot" jsonb,
  "lastPdvUpdatedAt" timestamptz,
  "lastSyncedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("companyId", "pdvProductId")
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pdv_product_links_listing
  ON pdv_product_links("companyId", "listingId") WHERE "listingId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS pdv_sale_links (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "pdvSaleId" varchar NOT NULL,
  "piraOrderId" uuid,
  "remoteSnapshot" jsonb,
  status varchar(32) NOT NULL DEFAULT 'OBSERVED',
  "lastSyncedAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("companyId", "pdvSaleId")
);

CREATE TABLE IF NOT EXISTS pdv_integration_events (
  id uuid PRIMARY KEY,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  direction varchar(16) NOT NULL,
  kind varchar(80) NOT NULL,
  "externalId" varchar,
  status varchar(24) NOT NULL DEFAULT 'SUCCESS',
  payload jsonb,
  error text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdv_integration_events_company_created
  ON pdv_integration_events("companyId", "createdAt" DESC);
