-- Vagas externas e alertas comunitários.
ALTER TABLE jobs ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "isExternalListing" boolean NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "sourceName" varchar NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "sourceUrl" text NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "reportCount" integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isOpenToWork" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS job_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId" varchar NOT NULL,
  "reporterKey" varchar NOT NULL,
  reason varchar(40) NOT NULL,
  details text NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("jobId", "reporterKey")
);
CREATE INDEX IF NOT EXISTS job_reports_job_created_idx ON job_reports ("jobId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS company_talent_folders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "companyId" varchar NOT NULL, name varchar(100) NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("companyId", name));
CREATE TABLE IF NOT EXISTS company_talent_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "companyId" varchar NOT NULL, "candidateId" varchar NOT NULL, "folderIds" jsonb NOT NULL DEFAULT '[]'::jsonb, status varchar NOT NULL DEFAULT 'SAVED', "jobIds" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("companyId", "candidateId"));
CREATE TABLE IF NOT EXISTS company_candidate_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "recordId" varchar NOT NULL, "authorId" varchar NOT NULL, body text NOT NULL, type varchar NOT NULL DEFAULT 'NOTE', "createdAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS company_talent_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "companyId" varchar NOT NULL, "candidateId" varchar NOT NULL, "jobId" varchar NOT NULL, status varchar NOT NULL DEFAULT 'PENDING', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("candidateId", "jobId"));

-- Localização estruturada, canais externos e rastreabilidade da API v1.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS city varchar NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS state varchar(2) NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "applicationEmail" varchar(254) NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "applicationWhatsApp" varchar(24) NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "externalFingerprint" varchar(64) NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "ingestionSourceId" varchar NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "ingestionSourceName" varchar(120) NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "moderationStatus" varchar(24) NOT NULL DEFAULT 'APPROVED';

CREATE UNIQUE INDEX IF NOT EXISTS jobs_external_fingerprint_unique_idx
  ON jobs ("externalFingerprint")
  WHERE "externalFingerprint" IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_ingestion_source_created_idx
  ON jobs ("ingestionSourceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS jobs_moderation_status_created_idx
  ON jobs ("moderationStatus", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS external_api_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  "sourceLabel" varchar(160) NOT NULL,
  "keyPrefix" varchar(20) NOT NULL UNIQUE,
  "keyHash" varchar(64) NOT NULL,
  scopes jsonb NOT NULL DEFAULT '["jobs:read","jobs:write"]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  "createdById" varchar NOT NULL,
  "lastUsedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_api_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId" varchar NOT NULL,
  action varchar(40) NOT NULL,
  "jobId" varchar NULL,
  result varchar(24) NOT NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS external_api_requests_client_created_idx
  ON external_api_requests ("clientId", "createdAt" DESC);
