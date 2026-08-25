BEGIN;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "reviewStatus" varchar(32) NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS "reviewedAt" timestamp NULL,
  ADD COLUMN IF NOT EXISTS "reviewedBy" varchar(160) NULL,
  ADD COLUMN IF NOT EXISTS "reviewNote" text NULL;

UPDATE jobs
SET
  "reviewStatus" = CASE
    WHEN "flagReason" = 'NOT_FOUND' AND "active" = true THEN 'DEACTIVATION_REQUIRED'
    WHEN "flagReason" = 'UNCERTAIN' THEN 'RECHECK_REQUIRED'
    WHEN "flagReason" IN ('CLOSED', 'EXPIRED') AND "active" = false THEN 'RESOLVED'
    WHEN "flagReason" IN ('CLOSED', 'EXPIRED') THEN 'DEACTIVATION_REQUIRED'
    WHEN "moderationStatus" = 'REJECTED' THEN 'RESOLVED'
    WHEN "moderationStatus" = 'APPROVED' AND "active" = true AND COALESCE("isFlagged", false) = false THEN 'REVIEWED_OK'
    WHEN "lastVerifiedAt" IS NOT NULL AND "active" = true AND COALESCE("isFlagged", false) = false THEN 'REVIEWED_OK'
    ELSE 'PENDING_REVIEW'
  END,
  "reviewedAt" = CASE
    WHEN "lastVerifiedAt" IS NOT NULL THEN COALESCE("reviewedAt", "lastVerifiedAt")
    ELSE "reviewedAt"
  END,
  "reviewedBy" = CASE
    WHEN "lastVerifiedAt" IS NOT NULL THEN COALESCE("reviewedBy", 'migration:verification')
    ELSE "reviewedBy"
  END
WHERE "reviewStatus" = 'PENDING_REVIEW';

CREATE INDEX IF NOT EXISTS idx_jobs_review_status ON jobs ("reviewStatus");
CREATE INDEX IF NOT EXISTS idx_jobs_review_status_active ON jobs ("reviewStatus", active);

ALTER TABLE external_api_clients
  ADD COLUMN IF NOT EXISTS "apiVersion" varchar(8) NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "audience" varchar(12) NOT NULL DEFAULT 'api';

CREATE INDEX IF NOT EXISTS idx_external_api_clients_version_audience
  ON external_api_clients ("apiVersion", audience, active);

-- Mantém automaticamente a fila operacional sincronizada com verificações
-- feitas pela API V1, V2 ou MCP sem misturar o estado de moderação.
CREATE OR REPLACE FUNCTION pn_sync_job_review_from_verification()
RETURNS trigger AS $$
BEGIN
  IF NEW."lastVerifiedAt" IS DISTINCT FROM OLD."lastVerifiedAt" THEN
    IF NEW."flagReason" = 'NOT_FOUND' AND NEW.active = true THEN
      NEW."reviewStatus" := 'DEACTIVATION_REQUIRED';
    ELSIF NEW."flagReason" = 'UNCERTAIN' THEN
      NEW."reviewStatus" := 'RECHECK_REQUIRED';
    ELSIF NEW."flagReason" IN ('CLOSED', 'EXPIRED') AND NEW.active = false THEN
      NEW."reviewStatus" := 'RESOLVED';
    ELSIF NEW."flagReason" IN ('CLOSED', 'EXPIRED') THEN
      NEW."reviewStatus" := 'DEACTIVATION_REQUIRED';
    ELSIF NEW.active = true AND COALESCE(NEW."isFlagged", false) = false THEN
      NEW."reviewStatus" := 'REVIEWED_OK';
    END IF;

    NEW."reviewedAt" := COALESCE(NEW."reviewedAt", NEW."lastVerifiedAt", NOW());
    NEW."reviewedBy" := COALESCE(NEW."reviewedBy", 'verification');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_sync_job_review_from_verification ON jobs;
CREATE TRIGGER trg_pn_sync_job_review_from_verification
BEFORE UPDATE OF "lastVerifiedAt" ON jobs
FOR EACH ROW
EXECUTE FUNCTION pn_sync_job_review_from_verification();

COMMIT;
