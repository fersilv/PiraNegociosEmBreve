ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "resumeStatus" varchar(16) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "resumePublishedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "uploadedResumeFile" jsonb NULL;

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "requiresResumeFile" boolean NOT NULL DEFAULT false;

ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "resumeSnapshot" jsonb NULL;

UPDATE "users"
SET "resumeStatus" = 'DRAFT'
WHERE "resumeStatus" IS NULL;
