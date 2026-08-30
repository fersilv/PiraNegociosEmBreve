CREATE TABLE IF NOT EXISTS company_mcp_oauth_clients (
  id uuid PRIMARY KEY,
  "clientId" varchar(120) NOT NULL UNIQUE,
  "clientName" varchar(180),
  "redirectUris" jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_mcp_connection_codes (
  id uuid PRIMARY KEY,
  "codeHash" varchar(64) NOT NULL UNIQUE,
  "companyId" uuid NOT NULL,
  "authorizedByUserId" varchar NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expiresAt" timestamptz NOT NULL,
  "usedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_mcp_connection_company ON company_mcp_connection_codes("companyId", "authorizedByUserId");

CREATE TABLE IF NOT EXISTS company_mcp_oauth_codes (
  id uuid PRIMARY KEY,
  "codeHash" varchar(64) NOT NULL UNIQUE,
  "clientId" varchar(120) NOT NULL,
  "companyId" uuid NOT NULL,
  "authorizedByUserId" varchar NOT NULL,
  "redirectUri" text NOT NULL,
  resource text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  "codeChallenge" varchar(128) NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "usedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_mcp_oauth_codes_client ON company_mcp_oauth_codes("clientId", "companyId");

CREATE TABLE IF NOT EXISTS company_mcp_oauth_tokens (
  id uuid PRIMARY KEY,
  "clientId" varchar(120) NOT NULL,
  "companyId" uuid NOT NULL,
  "authorizedByUserId" varchar NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_company_mcp_oauth_tokens_binding ON company_mcp_oauth_tokens("companyId", "authorizedByUserId", "clientId");
