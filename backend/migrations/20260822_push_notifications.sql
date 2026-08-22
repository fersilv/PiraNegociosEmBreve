CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "fcmToken" varchar;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL,
  "title" varchar NOT NULL,
  "message" text NOT NULL,
  "read" boolean NOT NULL DEFAULT false,
  "link" varchar NULL,
  "type" varchar NULL,
  "jobId" varchar NULL,
  "appId" varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "link" varchar,
  ADD COLUMN IF NOT EXISTS "type" varchar,
  ADD COLUMN IF NOT EXISTS "jobId" varchar,
  ADD COLUMN IF NOT EXISTS "appId" varchar,
  ADD COLUMN IF NOT EXISTS "read" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS "IDX_notifications_user_created"
  ON "notifications" ("userId", "createdAt" DESC);
