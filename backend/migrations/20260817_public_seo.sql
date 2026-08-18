-- Public SEO addresses. Run once against production before deploying the backend.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug varchar;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS slug varchar;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements text;
DO $$ BEGIN
  CREATE TYPE companies_category_enum AS ENUM ('EMPLOYER', 'SERVICE_PROVIDER', 'RETAILER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS category companies_category_enum NOT NULL DEFAULT 'EMPLOYER';

DO $$ BEGIN
  CREATE TYPE user_sanctions_status_enum AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS user_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL,
  "createdById" varchar NOT NULL,
  type varchar(40) NOT NULL,
  reason text NOT NULL,
  status user_sanctions_status_enum NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sanctions_user_created_idx ON user_sanctions ("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(120) NOT NULL,
  type varchar(32) NOT NULL,
  description text NULL,
  "imageURL" text NOT NULL,
  link text NOT NULL,
  "companyId" varchar NULL,
  "contractedByUserId" varchar NULL,
  price numeric(12,2) NULL,
  "billingPeriod" varchar(20) NULL,
  "startsAt" timestamptz NULL,
  "endsAt" timestamptz NULL,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS advertisements_active_period_idx ON advertisements (active, "startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS advertising_configs (
  id varchar PRIMARY KEY,
  "googleAdsEnabled" boolean NOT NULL DEFAULT false,
  "googleAdsClient" varchar NULL,
  "googleAdsSlotLeaderboard" varchar NULL,
  "googleAdsSlotRectangle" varchar NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

WITH normalized AS (
  SELECT id,
    NULLIF(trim(both '-' FROM regexp_replace(translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')), '') AS base_slug,
    row_number() OVER (
      PARTITION BY NULLIF(trim(both '-' FROM regexp_replace(translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')), '')
      ORDER BY "createdAt", id
    ) AS sequence
  FROM companies
  WHERE slug IS NULL
)
UPDATE companies AS company
SET slug = CASE
  WHEN normalized.base_slug IS NULL THEN 'empresa-' || substring(company.id::text, 1, 8)
  WHEN normalized.sequence = 1 THEN left(normalized.base_slug, 72)
  ELSE left(normalized.base_slug, 60) || '-' || normalized.sequence
END
FROM normalized
WHERE company.id = normalized.id;

WITH normalized AS (
  SELECT job.id,
    NULLIF(trim(both '-' FROM regexp_replace(translate(lower(concat(job.title, '-', coalesce(company.slug, company.name))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')), '') AS base_slug,
    row_number() OVER (
      PARTITION BY NULLIF(trim(both '-' FROM regexp_replace(translate(lower(concat(job.title, '-', coalesce(company.slug, company.name))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g')), '')
      ORDER BY job."createdAt", job.id
    ) AS sequence
  FROM jobs AS job
  LEFT JOIN companies AS company ON company.id = job."companyId"
  WHERE job.slug IS NULL
)
UPDATE jobs AS job
SET slug = CASE
  WHEN normalized.base_slug IS NULL THEN 'vaga-' || substring(job.id::text, 1, 8)
  WHEN normalized.sequence = 1 THEN left(normalized.base_slug, 72)
  ELSE left(normalized.base_slug, 60) || '-' || normalized.sequence
END
FROM normalized
WHERE job.id = normalized.id;

CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_unique_idx ON companies (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_slug_unique_idx ON jobs (slug) WHERE slug IS NOT NULL;
