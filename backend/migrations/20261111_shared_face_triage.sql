-- Triage metadata only; no face embeddings or copies of biometric images.
CREATE TABLE IF NOT EXISTS identity_face_checks (
 "verificationId" uuid PRIMARY KEY REFERENCES identity_verifications(id) ON DELETE CASCADE,
 status varchar(32) NOT NULL,
 reason varchar(100) NOT NULL,
 similarity numeric(6,5) NULL,
 "checkedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identity_face_checks_status_idx ON identity_face_checks(status,"checkedAt");
