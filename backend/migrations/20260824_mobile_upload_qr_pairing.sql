ALTER TABLE mobile_upload_sessions
  ADD COLUMN IF NOT EXISTS "qrTokenHash" varchar(64) NULL;

-- Sessões criadas antes da validação atual podem ter valores antigos de purpose.
-- Corrige esses registros antes de reaplicar a constraint para impedir novos casos.
UPDATE mobile_upload_sessions
SET purpose = 'document'
WHERE purpose IS NULL OR purpose NOT IN ('avatar', 'resume', 'document');

ALTER TABLE mobile_upload_sessions
  DROP CONSTRAINT IF EXISTS mobile_upload_sessions_purpose_check;
ALTER TABLE mobile_upload_sessions
  ADD CONSTRAINT mobile_upload_sessions_purpose_check
  CHECK (purpose IN ('avatar', 'resume', 'document'));

CREATE INDEX IF NOT EXISTS mobile_upload_sessions_qr_token_idx
  ON mobile_upload_sessions ("qrTokenHash")
  WHERE "qrTokenHash" IS NOT NULL;
