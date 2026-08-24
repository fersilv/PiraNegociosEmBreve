ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "isInternal" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "IDX_jobs_public_visibility"
  ON "jobs" ("createdAt" DESC)
  WHERE active = true AND "isInternal" = false;

-- Convites para vagas internas, inclusive antes de o candidato possuir conta.
ALTER TABLE company_talent_invites
  ALTER COLUMN "candidateId" DROP NOT NULL;

ALTER TABLE company_talent_invites
  ADD COLUMN IF NOT EXISTS "candidateEmail" varchar(254) NULL,
  ADD COLUMN IF NOT EXISTS "candidateName" varchar(140) NULL,
  ADD COLUMN IF NOT EXISTS "invitedById" varchar NULL,
  ADD COLUMN IF NOT EXISTS "tokenHash" varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS "expiresAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "viewedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "registeredAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "acceptedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "declinedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "emailStatus" varchar(24) NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS "emailSentAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "emailMessageId" varchar NULL,
  ADD COLUMN IF NOT EXISTS "emailError" text NULL;

UPDATE company_talent_invites AS invite
SET
  "candidateEmail" = lower(trim(app_user.email)),
  "candidateName" = COALESCE(
    NULLIF(trim(app_user."socialName"), ''),
    NULLIF(trim(app_user."displayName"), ''),
    NULLIF(trim(app_user."fullName"), '')
  ),
  "registeredAt" = app_user."createdAt"
FROM users AS app_user
WHERE invite."candidateId" = app_user.id
  AND invite."candidateEmail" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_company_talent_invites_email_job"
  ON company_talent_invites ("candidateEmail", "jobId")
  WHERE "candidateEmail" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_company_talent_invites_token_hash"
  ON company_talent_invites ("tokenHash")
  WHERE "tokenHash" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_company_talent_invites_company_status"
  ON company_talent_invites ("companyId", status, "createdAt" DESC);
