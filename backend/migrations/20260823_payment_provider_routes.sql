DROP INDEX IF EXISTS payment_providers_single_active_idx;

CREATE TABLE IF NOT EXISTS payment_provider_routes (
  "paymentType" varchar(40) PRIMARY KEY,
  "providerCode" varchar(40) NULL REFERENCES payment_providers(code) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT false,
  "activatedAt" timestamptz NULL,
  "updatedBy" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_routes_type_chk CHECK ("paymentType" IN ('PIX','PIX_AUTOMATICO'))
);

INSERT INTO payment_provider_routes ("paymentType") VALUES ('PIX'), ('PIX_AUTOMATICO')
ON CONFLICT ("paymentType") DO NOTHING;

-- Migração suave do modelo antigo de provedor único.
UPDATE payment_provider_routes r
SET "providerCode" = p.code,
    enabled = true,
    "activatedAt" = COALESCE(p."activatedAt", now()),
    "updatedAt" = now()
FROM payment_providers p
WHERE p.active = true
  AND r."paymentType" = 'PIX';

UPDATE payment_provider_routes r
SET "providerCode" = p.code,
    enabled = true,
    "activatedAt" = COALESCE(p."activatedAt", now()),
    "updatedAt" = now()
FROM payment_providers p
WHERE p.active = true
  AND p.code = 'EFI'
  AND r."paymentType" = 'PIX_AUTOMATICO';

-- O campo legacy continua existindo para compatibilidade, mas deixa de decidir o roteamento.
UPDATE payment_providers SET active = false, "activatedAt" = NULL WHERE active = true;

CREATE INDEX IF NOT EXISTS payment_provider_routes_provider_idx
  ON payment_provider_routes ("providerCode")
  WHERE enabled = true;
