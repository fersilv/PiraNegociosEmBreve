ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "whatsappPhoneE164" varchar(20),
  ADD COLUMN IF NOT EXISTS "whatsappId" varchar(80),
  ADD COLUMN IF NOT EXISTS "whatsappVerifiedAt" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_whatsappPhoneE164_unique"
  ON users ("whatsappPhoneE164")
  WHERE "whatsappPhoneE164" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_whatsappId_unique"
  ON users ("whatsappId")
  WHERE "whatsappId" IS NOT NULL;

ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS "isPrimarySupport" boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_whatsapp_instances_primary_support"
  ON whatsapp_instances ("isPrimarySupport")
  WHERE "isPrimarySupport" = true;

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "instanceId" uuid NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  "chatId" varchar(120) NOT NULL,
  "whatsappId" varchar(80),
  "phoneE164" varchar(20),
  "userId" varchar,
  "companyId" varchar,
  "contextMode" varchar(24) NOT NULL DEFAULT 'UNRESOLVED',
  "activeFlow" varchar(40),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  "lastInboundAt" timestamptz,
  "lastProcessedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_whatsapp_conversations_instance_chat" UNIQUE ("instanceId", "chatId")
);

CREATE INDEX IF NOT EXISTS "IDX_whatsapp_conversations_user"
  ON whatsapp_conversations ("userId");
CREATE INDEX IF NOT EXISTS "IDX_whatsapp_conversations_phone"
  ON whatsapp_conversations ("phoneE164");

CREATE TABLE IF NOT EXISTS whatsapp_phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL,
  "instanceId" uuid NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  "phoneE164" varchar(20) NOT NULL,
  "whatsappId" varchar(80),
  "codeHash" varchar(64) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  "expiresAt" timestamptz NOT NULL,
  "verifiedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_whatsapp_phone_otps_user_phone"
  ON whatsapp_phone_otps ("userId", "phoneE164");
CREATE INDEX IF NOT EXISTS "IDX_whatsapp_phone_otps_expiry"
  ON whatsapp_phone_otps ("expiresAt");
