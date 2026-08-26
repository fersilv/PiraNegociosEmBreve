CREATE TABLE IF NOT EXISTS payment_provider_test_profiles (
  "providerCode" varchar(32) NOT NULL,
  "profileCode" varchar(32) NOT NULL,
  "encryptedConfig" text NOT NULL,
  "updatedBy" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("providerCode", "profileCode"),
  CONSTRAINT payment_provider_test_profiles_provider_check CHECK ("providerCode" IN ('MERCADO_PAGO')),
  CONSTRAINT payment_provider_test_profiles_profile_check CHECK ("profileCode" IN ('ORDERS','SUBSCRIPTIONS','MARKETPLACE'))
);

CREATE TABLE IF NOT EXISTS payment_provider_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerCode" varchar(32) NOT NULL,
  "profileCode" varchar(32) NOT NULL,
  action varchar(48) NOT NULL,
  success boolean NOT NULL,
  "providerResourceId" varchar(220) NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "actorUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_test_runs_provider_check CHECK ("providerCode" IN ('MERCADO_PAGO')),
  CONSTRAINT payment_provider_test_runs_profile_check CHECK ("profileCode" IN ('ORDERS','SUBSCRIPTIONS','MARKETPLACE'))
);

CREATE INDEX IF NOT EXISTS payment_provider_test_runs_recent_idx
  ON payment_provider_test_runs ("providerCode", "profileCode", "createdAt" DESC);

COMMENT ON TABLE payment_provider_test_profiles IS
  'Credenciais exclusivas de teste dos provedores, criptografadas pelo cofre local e isoladas das credenciais produtivas.';
COMMENT ON TABLE payment_provider_test_runs IS
  'Histórico administrativo de chamadas reais aos ambientes de teste, incluindo IDs úteis para certificação.';
