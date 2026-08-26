BEGIN;

-- Corrige vagas que foram publicadas pela verificação automática antes da
-- decisão humana de moderação.
UPDATE jobs
SET
  active = false,
  "reviewStatus" = 'PENDING_REVIEW',
  "reviewedAt" = NULL,
  "reviewedBy" = NULL,
  "reviewNote" = NULL
WHERE "moderationStatus" = 'PENDING'
  AND active = true;

-- Uma vaga rejeitada também nunca deve permanecer publicamente ativa.
UPDATE jobs
SET
  active = false,
  "reviewStatus" = 'RESOLVED'
WHERE "moderationStatus" = 'REJECTED'
  AND active = true;

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_unreviewed_cannot_be_active;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_unreviewed_cannot_be_active
  CHECK (
    active = false
    OR "moderationStatus" NOT IN ('PENDING', 'REJECTED')
  ) NOT VALID;

ALTER TABLE jobs VALIDATE CONSTRAINT jobs_unreviewed_cannot_be_active;

COMMIT;
