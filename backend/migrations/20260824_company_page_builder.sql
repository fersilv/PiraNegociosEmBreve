CREATE TABLE IF NOT EXISTS company_pages (
  "companyId" uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  "templateKey" varchar(80) NOT NULL DEFAULT 'essencial',
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  published jsonb NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  revision integer NOT NULL DEFAULT 1,
  "publishedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_pages_status_check CHECK (status IN ('DRAFT','PUBLISHED')),
  CONSTRAINT company_pages_revision_check CHECK (revision >= 1)
);

CREATE TABLE IF NOT EXISTS company_page_previews (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_page_previews_company_idx
  ON company_page_previews ("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS company_page_previews_expiry_idx
  ON company_page_previews ("expiresAt");
