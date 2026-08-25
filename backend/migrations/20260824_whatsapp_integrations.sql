DO $$ BEGIN
  CREATE TYPE whatsapp_connection_status_enum AS ENUM ('DISCONNECTED', 'CONNECTING', 'QR_REQUIRED', 'CONNECTED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_message_direction_enum AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  purpose varchar(180),
  "phoneNumber" varchar(32),
  "sessionName" varchar(40) NOT NULL UNIQUE,
  provider varchar(30) NOT NULL DEFAULT 'wppconnect',
  status whatsapp_connection_status_enum NOT NULL DEFAULT 'DISCONNECTED',
  "allowedScopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  "lastError" text,
  "lastConnectedAt" timestamptz,
  "lastSeenAt" timestamptz,
  "createdById" varchar NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "instanceId" uuid NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  "keyPrefix" varchar(24) NOT NULL UNIQUE,
  "keyHash" varchar(64) NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  "createdById" varchar NOT NULL,
  "lastUsedAt" timestamptz,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_api_keys_instance_active ON whatsapp_api_keys ("instanceId", active);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "instanceId" uuid NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  "providerMessageId" varchar(100),
  "chatId" varchar(120) NOT NULL,
  "senderId" varchar(120),
  direction whatsapp_message_direction_enum NOT NULL,
  type varchar(40) NOT NULL DEFAULT 'text',
  body text,
  metadata jsonb,
  "providerTimestamp" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_instance_created ON whatsapp_messages ("instanceId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS whatsapp_saved_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "instanceId" uuid NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  "waId" varchar(120) NOT NULL,
  "phoneNumber" varchar(32) NOT NULL,
  name varchar(160) NOT NULL,
  notes text,
  metadata jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("instanceId", "waId")
);
