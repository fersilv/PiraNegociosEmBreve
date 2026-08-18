-- Apply once in production: psql "$DATABASE_URL" -f migrations/20260817_analytics.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "visitorId" varchar(128) NOT NULL,
  "sessionId" varchar(128),
  "eventType" varchar(32) NOT NULL,
  path varchar(512) NOT NULL,
  "referrerOrigin" varchar(255),
  "utmSource" varchar(120),
  "utmMedium" varchar(120),
  "utmCampaign" varchar(120),
  "deviceType" varchar(32),
  browser varchar(80),
  "operatingSystem" varchar(80),
  "durationSeconds" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_visitor_events_createdAt" ON visitor_events ("createdAt");
CREATE INDEX IF NOT EXISTS "IDX_visitor_events_visitor_created" ON visitor_events ("visitorId", "createdAt");

CREATE TABLE IF NOT EXISTS account_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL,
  "ipHash" varchar(128),
  "deviceHash" varchar(128),
  "deviceType" varchar(32),
  browser varchar(80),
  "operatingSystem" varchar(80),
  "isNewDevice" boolean NOT NULL DEFAULT false,
  "eventType" varchar(32) NOT NULL DEFAULT 'PROFILE_ACCESS',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_account_accesses_user_created" ON account_accesses ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "IDX_account_accesses_ip_created" ON account_accesses ("ipHash", "createdAt");
