CREATE TABLE IF NOT EXISTS mobile_upload_sessions (
  id uuid PRIMARY KEY,
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose varchar(16) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'WAITING',
  "pairingHash" varchar(64) NOT NULL,
  "pairingSalt" varchar(64) NOT NULL,
  "pairingAttempts" integer NOT NULL DEFAULT 0,
  "uploadTokenHash" varchar(64) NULL,
  "maxSizeBytes" integer NOT NULL,
  accept text NOT NULL,
  "filePath" text NULL,
  "fileName" text NULL,
  "mimeType" varchar NULL,
  "fileSize" integer NULL,
  "expiresAt" timestamptz NOT NULL,
  "pairedAt" timestamptz NULL,
  "uploadedAt" timestamptz NULL,
  "consumedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mobile_upload_sessions_purpose_check CHECK (purpose IN ('avatar','resume','document')),
  CONSTRAINT mobile_upload_sessions_status_check CHECK (status IN ('WAITING','PAIRED','UPLOADED','CONSUMED','EXPIRED','CANCELED')),
  CONSTRAINT mobile_upload_sessions_attempts_check CHECK ("pairingAttempts" >= 0),
  CONSTRAINT mobile_upload_sessions_size_check CHECK ("maxSizeBytes" > 0)
);

CREATE INDEX IF NOT EXISTS mobile_upload_sessions_user_status_idx
  ON mobile_upload_sessions ("userId", status);
CREATE INDEX IF NOT EXISTS mobile_upload_sessions_expires_idx
  ON mobile_upload_sessions ("expiresAt");
