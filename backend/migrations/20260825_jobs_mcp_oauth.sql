CREATE TABLE IF NOT EXISTS jobs_oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId" varchar(120) NOT NULL UNIQUE,
  "clientName" varchar(180),
  "redirectUris" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "tokenEndpointAuthMethod" varchar(40) NOT NULL DEFAULT 'none',
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs_oauth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "codeHash" varchar(64) NOT NULL UNIQUE,
  "clientId" varchar(120) NOT NULL,
  "apiClientId" uuid NOT NULL REFERENCES external_api_clients(id) ON DELETE CASCADE,
  "redirectUri" text NOT NULL,
  resource text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  "codeChallenge" varchar(128) NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "usedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_oauth_codes_api_client
  ON jobs_oauth_codes ("apiClientId", "clientId");

CREATE TABLE IF NOT EXISTS jobs_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "apiClientId" uuid NOT NULL REFERENCES external_api_clients(id) ON DELETE CASCADE,
  "clientId" varchar(120) NOT NULL,
  "accessTokenHash" varchar(64) NOT NULL UNIQUE,
  "refreshTokenHash" varchar(64) NOT NULL UNIQUE,
  resource text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  "accessExpiresAt" timestamptz NOT NULL,
  "refreshExpiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_oauth_tokens_api_client
  ON jobs_oauth_tokens ("apiClientId", "clientId");
