ALTER TABLE users
ADD COLUMN IF NOT EXISTS "resumePreferences" jsonb NULL;
