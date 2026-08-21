ALTER TABLE users
ADD COLUMN IF NOT EXISTS "resumeScoreUnlocked" boolean NOT NULL DEFAULT false;
