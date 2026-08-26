CREATE TABLE IF NOT EXISTS company_verification_authorization_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "authorizationId" uuid NOT NULL REFERENCES company_verification_authorizations(id) ON DELETE CASCADE,
  "actorUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action varchar(24) NOT NULL DEFAULT 'VIEW_SELFIE',
  "ipHash" varchar(64) NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_verification_authorization_access_action_check
    CHECK (action IN ('VIEW_SELFIE','REVIEW'))
);
CREATE INDEX IF NOT EXISTS company_verification_authorization_access_idx
  ON company_verification_authorization_access_logs("authorizationId","createdAt" DESC);
