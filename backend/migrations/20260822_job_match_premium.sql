ALTER TABLE payment_products
  ADD COLUMN IF NOT EXISTS "durationDays" integer NULL;

ALTER TABLE payment_products
  DROP CONSTRAINT IF EXISTS payment_products_duration_days_check;
ALTER TABLE payment_products
  ADD CONSTRAINT payment_products_duration_days_check
  CHECK ("durationDays" IS NULL OR "durationDays" > 0);

INSERT INTO payment_products
  (code, name, description, "priceCents", enabled, "freeUses", "sortOrder", "durationDays")
VALUES
  ('JOB_MATCH_30D', 'Match Inteligente · 30 dias', 'Libera pontuação de compatibilidade, evidências, lacunas e ranking inteligente de vagas por período.', 299, true, 0, 40, 30)
ON CONFLICT (code) DO UPDATE
SET "durationDays" = COALESCE(payment_products."durationDays", EXCLUDED."durationDays");

CREATE TABLE IF NOT EXISTS user_feature_entitlements (
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature varchar(64) NOT NULL,
  "startsAt" timestamptz NOT NULL DEFAULT now(),
  "expiresAt" timestamptz NOT NULL,
  "paymentId" uuid NULL REFERENCES payments(id) ON DELETE SET NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", feature)
);
CREATE INDEX IF NOT EXISTS user_feature_entitlements_expiry_idx
  ON user_feature_entitlements (feature, "expiresAt");

CREATE TABLE IF NOT EXISTS job_match_profiles (
  "jobId" uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL DEFAULT 'PENDING',
  "algorithmVersion" varchar(32) NOT NULL,
  "sourceFingerprint" varchar(64) NOT NULL,
  profile jsonb NULL,
  error text NULL,
  "analyzedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_match_profiles_status_check CHECK (status IN ('PENDING','READY','ERROR'))
);
CREATE INDEX IF NOT EXISTS job_match_profiles_status_idx
  ON job_match_profiles (status, "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS job_match_results (
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "jobId" uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  "resumeFingerprint" varchar(64) NOT NULL,
  "jobProfileFingerprint" varchar(64) NOT NULL,
  "algorithmVersion" varchar(32) NOT NULL,
  score integer NOT NULL,
  result jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "jobId"),
  CONSTRAINT job_match_results_score_check CHECK (score >= 0 AND score <= 100)
);
CREATE INDEX IF NOT EXISTS job_match_results_user_score_idx
  ON job_match_results ("userId", score DESC, "updatedAt" DESC);
