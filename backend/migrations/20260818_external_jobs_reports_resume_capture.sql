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
