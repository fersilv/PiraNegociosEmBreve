-- Comércio, entregas e orçamentos - Fase 0
-- Fundação financeira, auditoria, reconciliação e idempotência.
-- Todos os valores monetários persistidos aqui são inteiros em centavos.

ALTER TABLE classified_orders
  ADD COLUMN IF NOT EXISTS "itemSubtotalCents" bigint NULL,
  ADD COLUMN IF NOT EXISTS "shippingCents" bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "buyerFeeCents" bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "applicationFeeCents" bigint NULL,
  ADD COLUMN IF NOT EXISTS "providerFeeCents" bigint NULL,
  ADD COLUMN IF NOT EXISTS "providerNetCents" bigint NULL,
  ADD COLUMN IF NOT EXISTS "deliveryPartnerPayableCents" bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentFinancialSnapshot" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "deliveryQuoteSnapshot" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "paymentReconciledAt" timestamptz NULL;

-- Pedidos legados eram unitários e não possuíam frete/taxa do comprador separados.
-- O backfill apenas materializa componentes que já estavam historicamente gravados.
UPDATE classified_orders
SET "itemSubtotalCents" = COALESCE("itemSubtotalCents", "totalCents"::bigint),
    "applicationFeeCents" = COALESCE("applicationFeeCents", "platformFeeCents"::bigint)
WHERE "itemSubtotalCents" IS NULL OR "applicationFeeCents" IS NULL;

ALTER TABLE classified_orders
  DROP CONSTRAINT IF EXISTS classified_orders_phase0_money_check;
ALTER TABLE classified_orders
  ADD CONSTRAINT classified_orders_phase0_money_check CHECK (
    ("itemSubtotalCents" IS NULL OR "itemSubtotalCents" >= 0)
    AND "shippingCents" >= 0
    AND "buyerFeeCents" >= 0
    AND ("applicationFeeCents" IS NULL OR "applicationFeeCents" >= 0)
    AND ("providerFeeCents" IS NULL OR "providerFeeCents" >= 0)
    AND ("providerNetCents" IS NULL OR "providerNetCents" >= 0)
    AND "deliveryPartnerPayableCents" >= 0
  );

COMMENT ON COLUMN classified_orders."applicationFeeCents" IS
  'application_fee enviado ao Mercado Pago. Na fase de entrega poderá incluir comissão da plataforma + frete da plataforma.';
COMMENT ON COLUMN classified_orders."deliveryPartnerPayableCents" IS
  'Obrigação histórica com o parceiro de entrega. Não representa receita definitiva da plataforma.';
COMMENT ON COLUMN classified_orders."paymentFinancialSnapshot" IS
  'Snapshot imutável dos componentes financeiros usados para criar/reconciliar o pagamento.';
COMMENT ON COLUMN classified_orders."deliveryQuoteSnapshot" IS
  'Snapshot da cotação aprovada. Mudanças posteriores de tabela de frete não alteram o pedido.';

CREATE TABLE IF NOT EXISTS classified_payment_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES classified_orders(id) ON DELETE RESTRICT,
  provider varchar(24) NOT NULL,
  "providerPaymentId" varchar(180) NULL,
  source varchar(32) NOT NULL,
  "paymentStatus" varchar(32) NULL,
  "grossAmountCents" bigint NULL,
  "applicationFeeCents" bigint NULL,
  "providerFeeCents" bigint NULL,
  "providerNetCents" bigint NULL,
  "statusDetail" varchar(180) NULL,
  "eventFingerprint" varchar(128) NOT NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_payment_reconciliation_provider_check
    CHECK (provider IN ('MERCADO_PAGO','EFI','DIRECT')),
  CONSTRAINT classified_payment_reconciliation_source_check
    CHECK (source IN ('CHECKOUT_RESPONSE','WEBHOOK','RECONCILIATION','ADMIN')),
  CONSTRAINT classified_payment_reconciliation_money_check CHECK (
    ("grossAmountCents" IS NULL OR "grossAmountCents" >= 0)
    AND ("applicationFeeCents" IS NULL OR "applicationFeeCents" >= 0)
    AND ("providerFeeCents" IS NULL OR "providerFeeCents" >= 0)
    AND ("providerNetCents" IS NULL OR "providerNetCents" >= 0)
  ),
  CONSTRAINT classified_payment_reconciliation_event_uq UNIQUE ("eventFingerprint")
);

CREATE INDEX IF NOT EXISTS classified_payment_reconciliation_order_idx
  ON classified_payment_reconciliation_events("orderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_payment_reconciliation_provider_idx
  ON classified_payment_reconciliation_events(provider, "providerPaymentId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS classified_commerce_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope varchar(64) NOT NULL,
  key varchar(160) NOT NULL,
  "actorUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "companyId" uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  "requestHash" varchar(64) NOT NULL,
  "resourceType" varchar(64) NULL,
  "resourceId" varchar(180) NULL,
  "responseSnapshot" jsonb NULL,
  "completedAt" timestamptz NULL,
  "expiresAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_commerce_idempotency_uq UNIQUE (scope, key)
);

CREATE INDEX IF NOT EXISTS classified_commerce_idempotency_expiry_idx
  ON classified_commerce_idempotency_keys("expiresAt")
  WHERE "expiresAt" IS NOT NULL;

CREATE TABLE IF NOT EXISTS classified_commerce_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "aggregateType" varchar(64) NOT NULL,
  "aggregateId" varchar(180) NOT NULL,
  action varchar(80) NOT NULL,
  "actorUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "companyId" uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  "correlationId" varchar(160) NULL,
  "fromStatus" varchar(48) NULL,
  "toStatus" varchar(48) NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classified_commerce_audit_aggregate_idx
  ON classified_commerce_audit_events("aggregateType", "aggregateId", "createdAt" ASC);
CREATE INDEX IF NOT EXISTS classified_commerce_audit_company_idx
  ON classified_commerce_audit_events("companyId", "createdAt" DESC)
  WHERE "companyId" IS NOT NULL;

-- Ledger/audit records are append-only. Corrections must be represented by a new event.
CREATE OR REPLACE FUNCTION prevent_classified_commerce_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'commerce audit records are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classified_payment_reconciliation_immutable ON classified_payment_reconciliation_events;
CREATE TRIGGER trg_classified_payment_reconciliation_immutable
BEFORE UPDATE OR DELETE ON classified_payment_reconciliation_events
FOR EACH ROW EXECUTE FUNCTION prevent_classified_commerce_audit_mutation();

DROP TRIGGER IF EXISTS trg_classified_commerce_audit_immutable ON classified_commerce_audit_events;
CREATE TRIGGER trg_classified_commerce_audit_immutable
BEFORE UPDATE OR DELETE ON classified_commerce_audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_classified_commerce_audit_mutation();
