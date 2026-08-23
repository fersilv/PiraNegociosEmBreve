CREATE TABLE IF NOT EXISTS payment_providers (
  code varchar(40) PRIMARY KEY,
  name varchar(120) NOT NULL,
  description text NULL,
  active boolean NOT NULL DEFAULT false,
  "encryptedConfig" text NULL,
  "configVersion" integer NOT NULL DEFAULT 0,
  "lastHealthCheckAt" timestamptz NULL,
  "lastHealthCheckOk" boolean NULL,
  "lastHealthCheckMessage" text NULL,
  "lastHealthCheckDetails" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "activatedAt" timestamptz NULL,
  "updatedBy" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_providers_single_active_idx
  ON payment_providers (active)
  WHERE active = true;

INSERT INTO payment_providers (code, name, description) VALUES
  ('EFI', 'Efí Bank', 'Pix imediato e Pix Automático com certificado mTLS.'),
  ('MERCADO_PAGO', 'Mercado Pago', 'Pagamentos do ecossistema Mercado Livre com Pix e SDK oficial.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS payment_provider_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerCode" varchar(40) NOT NULL REFERENCES payment_providers(code) ON DELETE CASCADE,
  action varchar(40) NOT NULL,
  "actorUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_provider_audit_provider_idx
  ON payment_provider_audit ("providerCode", "createdAt" DESC);
