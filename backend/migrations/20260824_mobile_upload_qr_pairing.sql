ALTER TABLE mobile_upload_sessions
  ADD COLUMN IF NOT EXISTS "qrTokenHash" varchar(64) NULL;

CREATE INDEX IF NOT EXISTS mobile_upload_sessions_qr_token_idx
  ON mobile_upload_sessions ("qrTokenHash")
  WHERE "qrTokenHash" IS NOT NULL;
