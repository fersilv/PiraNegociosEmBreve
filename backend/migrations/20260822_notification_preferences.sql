ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "notificationPreferences" jsonb;
