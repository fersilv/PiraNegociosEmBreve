-- Modalidades comerciais independentes do produto.
-- Um mesmo produto pode ser vendido por assinatura (Pix Automático), compra avulsa (Pix) ou ambas.

ALTER TABLE payment_products
  ADD COLUMN IF NOT EXISTS "oneTimePriceCents" integer NULL,
  ADD COLUMN IF NOT EXISTS "subscriptionPriceCents" integer NULL,
  ADD COLUMN IF NOT EXISTS "preferredPurchaseMode" varchar(16) NOT NULL DEFAULT 'SUBSCRIPTION',
  ADD COLUMN IF NOT EXISTS "subscriptionBenefits" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "oneTimeBenefits" jsonb NULL;

ALTER TABLE payment_products
  DROP CONSTRAINT IF EXISTS payment_products_one_time_price_check,
  DROP CONSTRAINT IF EXISTS payment_products_subscription_price_check,
  DROP CONSTRAINT IF EXISTS payment_products_preferred_purchase_mode_check,
  DROP CONSTRAINT IF EXISTS payment_products_subscription_benefits_check,
  DROP CONSTRAINT IF EXISTS payment_products_one_time_benefits_check;

ALTER TABLE payment_products
  ADD CONSTRAINT payment_products_one_time_price_check
    CHECK ("oneTimePriceCents" IS NULL OR "oneTimePriceCents" >= 0),
  ADD CONSTRAINT payment_products_subscription_price_check
    CHECK ("subscriptionPriceCents" IS NULL OR "subscriptionPriceCents" >= 0),
  ADD CONSTRAINT payment_products_preferred_purchase_mode_check
    CHECK ("preferredPurchaseMode" IN ('ONE_TIME','SUBSCRIPTION')),
  ADD CONSTRAINT payment_products_subscription_benefits_check
    CHECK ("subscriptionBenefits" IS NULL OR jsonb_typeof("subscriptionBenefits") = 'array'),
  ADD CONSTRAINT payment_products_one_time_benefits_check
    CHECK ("oneTimeBenefits" IS NULL OR jsonb_typeof("oneTimeBenefits") = 'array');

-- Backfill apenas para produtos que ainda não receberam nenhuma configuração comercial.
-- Assim, executar novamente esta migração não reativa uma modalidade que o admin desligou.
UPDATE payment_products
SET "subscriptionPriceCents" = "priceCents",
    "preferredPurchaseMode" = 'SUBSCRIPTION'
WHERE "billingType" = 'RECURRING'
  AND "oneTimePriceCents" IS NULL
  AND "subscriptionPriceCents" IS NULL;

UPDATE payment_products
SET "oneTimePriceCents" = "priceCents",
    "preferredPurchaseMode" = 'ONE_TIME'
WHERE "billingType" <> 'RECURRING'
  AND "oneTimePriceCents" IS NULL
  AND "subscriptionPriceCents" IS NULL;

-- Migrações antigas ainda escrevem billingType/priceCents. Depois delas, este arquivo
-- restaura os campos legados a partir da modalidade principal escolhida pelo admin.
UPDATE payment_products
SET "billingType" = CASE WHEN "preferredPurchaseMode" = 'SUBSCRIPTION' THEN 'RECURRING' ELSE 'ONE_TIME' END,
    "priceCents" = CASE
      WHEN "preferredPurchaseMode" = 'SUBSCRIPTION' THEN COALESCE("subscriptionPriceCents", "oneTimePriceCents", "priceCents")
      ELSE COALESCE("oneTimePriceCents", "subscriptionPriceCents", "priceCents")
    END
WHERE "oneTimePriceCents" IS NOT NULL OR "subscriptionPriceCents" IS NOT NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "purchaseMode" varchar(16) NOT NULL DEFAULT 'ONE_TIME';

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_purchase_mode_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_purchase_mode_check
    CHECK ("purchaseMode" IN ('ONE_TIME','SUBSCRIPTION'));

-- Só converte pagamentos legados ainda sem marcação comercial explícita.
UPDATE payments p
SET "purchaseMode" = CASE WHEN pp."billingType" = 'RECURRING' THEN 'SUBSCRIPTION' ELSE 'ONE_TIME' END
FROM payment_products pp
WHERE pp.code = p."productCode"
  AND coalesce(p.metadata->>'purchaseMode', '') = '';

CREATE OR REPLACE FUNCTION settle_paid_product_benefits()
RETURNS trigger AS $$
DECLARE
  product_row payment_products%ROWTYPE;
  duration_days integer;
  period_end timestamptz;
  subscription_row subscriptions%ROWTYPE;
  benefit_source varchar(32);
BEGIN
  IF NEW.status <> 'PAID' OR OLD.status = 'PAID' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO product_row FROM payment_products WHERE code = NEW."productCode";
  IF NOT FOUND THEN RETURN NEW; END IF;
  duration_days := coalesce(product_row."durationDays", 30);
  benefit_source := CASE WHEN NEW."purchaseMode" = 'SUBSCRIPTION' THEN 'SUBSCRIPTION' ELSE 'PAYMENT' END;

  -- A assinatura pertence à transação escolhida, não mais ao cadastro fixo do produto.
  IF NEW."purchaseMode" = 'SUBSCRIPTION' THEN
    SELECT * INTO subscription_row
    FROM subscriptions
    WHERE "userId" = NEW."userId"
      AND "productCode" = NEW."productCode"
      AND status IN ('ACTIVE','PAST_DUE')
    LIMIT 1;

    IF FOUND THEN
      period_end := greatest(now(), subscription_row."currentPeriodEnd") + make_interval(days => duration_days);
      UPDATE subscriptions SET
        status = 'ACTIVE',
        provider = coalesce(NEW.provider, provider),
        "currentPeriodStart" = greatest(now(), subscription_row."currentPeriodEnd"),
        "currentPeriodEnd" = period_end,
        "isSimulation" = NEW."isSimulation",
        "updatedAt" = now()
      WHERE id = subscription_row.id
      RETURNING * INTO subscription_row;
    ELSE
      period_end := now() + make_interval(days => duration_days);
      INSERT INTO subscriptions
        ("userId", "productCode", status, provider, "currentPeriodStart", "currentPeriodEnd", "isSimulation", source)
      VALUES
        (NEW."userId", NEW."productCode", 'ACTIVE', NEW.provider, now(), period_end, NEW."isSimulation", 'PAYMENT')
      RETURNING * INTO subscription_row;
    END IF;

    UPDATE payments SET "subscriptionId" = subscription_row.id WHERE id = NEW.id;
  END IF;

  -- Benefícios continuam sendo os mesmos do produto, mas a origem reflete a modalidade escolhida.
  IF NEW."productCode" = 'JOB_MATCH_30D' THEN
    PERFORM extend_feature_entitlement(NEW."userId", 'JOB_MATCH_PREMIUM', duration_days, NEW.id, benefit_source);
  ELSIF NEW."productCode" IN ('RESUME_BOOST_7D', 'RESUME_BOOST_15D') THEN
    PERFORM extend_feature_entitlement(NEW."userId", 'RESUME_BOOST', duration_days, NEW.id, benefit_source);
  ELSIF NEW."productCode" = 'PREMIUM_MONTHLY' THEN
    PERFORM extend_feature_entitlement(NEW."userId", 'JOB_MATCH_PREMIUM', duration_days, NEW.id, benefit_source);
    PERFORM extend_feature_entitlement(NEW."userId", 'RESUME_BOOST', duration_days, NEW.id, benefit_source);
    PERFORM extend_feature_entitlement(NEW."userId", 'EARLY_JOB_ALERTS', duration_days, NEW.id, benefit_source);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Não tratar Mercado Pago Assinaturas (/preapproval) como Pix Automático.
-- Se uma versão anterior salvou essa rota e a Efí está saudável, migra a rota
-- automaticamente para Efí. A aplicação ainda valida pixAutomaticEnabled=true
-- antes de expor ou criar qualquer checkout recorrente.
UPDATE payment_provider_routes r
SET "providerCode" = 'EFI',
    enabled = true,
    "activatedAt" = now(),
    "updatedAt" = now()
WHERE r."paymentType" = 'PIX_AUTOMATICO'
  AND r."providerCode" = 'MERCADO_PAGO'
  AND EXISTS (
    SELECT 1
    FROM payment_providers p
    WHERE p.code = 'EFI'
      AND p."lastHealthCheckOk" = true
  );

-- Se não houver Efí saudável, desliga a rota em vez de abrir /preapproval do MP.
UPDATE payment_provider_routes
SET enabled = false,
    "providerCode" = NULL,
    "activatedAt" = NULL,
    "updatedAt" = now()
WHERE "paymentType" = 'PIX_AUTOMATICO'
  AND "providerCode" = 'MERCADO_PAGO';