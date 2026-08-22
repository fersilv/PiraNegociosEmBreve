ALTER TABLE payment_products
  ADD COLUMN IF NOT EXISTS "billingType" varchar(16) NOT NULL DEFAULT 'ONE_TIME',
  ADD COLUMN IF NOT EXISTS benefits jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE payment_products
  DROP CONSTRAINT IF EXISTS payment_products_billing_type_check;
ALTER TABLE payment_products
  ADD CONSTRAINT payment_products_billing_type_check
  CHECK ("billingType" IN ('ONE_TIME','RECURRING'));

UPDATE payment_products SET benefits = '[{"kind":"CREDIT","feature":"RESUME_REANALYSIS","quantity":1}]'::jsonb
WHERE code = 'RESUME_REANALYSIS' AND benefits = '[]'::jsonb;
UPDATE payment_products SET benefits = '[{"kind":"CREDIT","feature":"RESUME_AI_IMPROVEMENT","quantity":1}]'::jsonb
WHERE code = 'RESUME_AI_IMPROVEMENT' AND benefits = '[]'::jsonb;
UPDATE payment_products SET benefits = '[{"kind":"CREDIT","feature":"RESUME_AI_IMPORT","quantity":1}]'::jsonb
WHERE code = 'RESUME_AI_IMPORT' AND benefits = '[]'::jsonb;
UPDATE payment_products SET benefits = '[{"kind":"ENTITLEMENT","feature":"JOB_MATCH_PREMIUM"}]'::jsonb
WHERE code = 'JOB_MATCH_30D' AND benefits = '[]'::jsonb;

INSERT INTO payment_products
  (code, name, description, "priceCents", enabled, "freeUses", "sortOrder", "durationDays", "billingType", benefits)
VALUES
  ('RESUME_BOOST_15D', 'Impulso de currículo · 15 dias', 'Dá prioridade de exposição ao currículo entre candidatos da mesma faixa de compatibilidade. Não altera a pontuação de match.', 799, true, 0, 50, 15, 'ONE_TIME', '[{"kind":"ENTITLEMENT","feature":"RESUME_BOOST"}]'::jsonb),
  ('PREMIUM_MONTHLY', 'Plano Destaque mensal', 'Plano recorrente com Match Inteligente e impulso contínuo do currículo enquanto a mensalidade estiver ativa.', 999, true, 0, 60, 30, 'RECURRING', '[{"kind":"ENTITLEMENT","feature":"JOB_MATCH_PREMIUM"},{"kind":"ENTITLEMENT","feature":"RESUME_BOOST"}]'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  "billingType" = EXCLUDED."billingType",
  benefits = CASE WHEN payment_products.benefits = '[]'::jsonb THEN EXCLUDED.benefits ELSE payment_products.benefits END,
  "durationDays" = COALESCE(payment_products."durationDays", EXCLUDED."durationDays");

CREATE TABLE IF NOT EXISTS user_billing_profiles (
  "userId" varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  "lifetimeFree" boolean NOT NULL DEFAULT false,
  note text NULL,
  "updatedBy" varchar NULL,
  "lifetimeGrantedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_feature_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature varchar(64) NOT NULL,
  delta integer NOT NULL,
  reason varchar(64) NOT NULL,
  note text NULL,
  "paymentId" uuid NULL REFERENCES payments(id) ON DELETE SET NULL,
  "adminUserId" varchar NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_feature_credit_ledger_delta_check CHECK (delta <> 0)
);
CREATE INDEX IF NOT EXISTS user_feature_credit_ledger_user_idx
  ON user_feature_credit_ledger ("userId", "createdAt" DESC);

ALTER TABLE user_feature_entitlements
  ADD COLUMN IF NOT EXISTS source varchar(32) NOT NULL DEFAULT 'PAYMENT',
  ADD COLUMN IF NOT EXISTS note text NULL,
  ADD COLUMN IF NOT EXISTS "grantedBy" varchar NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "productCode" varchar(64) NOT NULL REFERENCES payment_products(code),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  provider varchar(80) NULL,
  "providerSubscriptionId" varchar(180) NULL,
  "currentPeriodStart" timestamptz NOT NULL DEFAULT now(),
  "currentPeriodEnd" timestamptz NOT NULL,
  "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
  "isSimulation" boolean NOT NULL DEFAULT false,
  source varchar(24) NOT NULL DEFAULT 'PAYMENT',
  "createdBy" varchar NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_check CHECK (status IN ('ACTIVE','PAST_DUE','CANCELED','EXPIRED'))
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions ("userId", "updatedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_unique
  ON subscriptions(provider, "providerSubscriptionId") WHERE "providerSubscriptionId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_product
  ON subscriptions("userId", "productCode") WHERE status IN ('ACTIVE','PAST_DUE');

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "subscriptionId" uuid NULL REFERENCES subscriptions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION extend_feature_entitlement(
  p_user_id varchar,
  p_feature varchar,
  p_duration_days integer,
  p_payment_id uuid,
  p_source varchar,
  p_granted_by varchar DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS timestamptz AS $$
DECLARE
  base_time timestamptz;
  next_expiry timestamptz;
BEGIN
  SELECT greatest(now(), coalesce("expiresAt", now())) INTO base_time
  FROM user_feature_entitlements
  WHERE "userId" = p_user_id AND feature = p_feature;
  base_time := coalesce(base_time, now());
  next_expiry := base_time + make_interval(days => greatest(1, p_duration_days));

  INSERT INTO user_feature_entitlements
    ("userId", feature, "startsAt", "expiresAt", "paymentId", source, "grantedBy", note, "updatedAt")
  VALUES
    (p_user_id, p_feature, now(), next_expiry, p_payment_id, p_source, p_granted_by, p_note, now())
  ON CONFLICT ("userId", feature) DO UPDATE SET
    "expiresAt" = next_expiry,
    "paymentId" = p_payment_id,
    source = p_source,
    "grantedBy" = p_granted_by,
    note = p_note,
    "updatedAt" = now();

  RETURN next_expiry;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION settle_paid_product_benefits()
RETURNS trigger AS $$
DECLARE
  product_row payment_products%ROWTYPE;
  duration_days integer;
  period_end timestamptz;
  subscription_row subscriptions%ROWTYPE;
BEGIN
  IF NEW.status <> 'PAID' OR OLD.status = 'PAID' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO product_row FROM payment_products WHERE code = NEW."productCode";
  IF NOT FOUND THEN RETURN NEW; END IF;
  duration_days := coalesce(product_row."durationDays", 30);

  IF NEW."productCode" = 'JOB_MATCH_30D' THEN
    PERFORM extend_feature_entitlement(NEW."userId", 'JOB_MATCH_PREMIUM', duration_days, NEW.id, 'PAYMENT');
  ELSIF NEW."productCode" = 'RESUME_BOOST_15D' THEN
    PERFORM extend_feature_entitlement(NEW."userId", 'RESUME_BOOST', duration_days, NEW.id, 'PAYMENT');
  ELSIF NEW."productCode" = 'PREMIUM_MONTHLY' THEN
    SELECT * INTO subscription_row
    FROM subscriptions
    WHERE "userId" = NEW."userId" AND "productCode" = NEW."productCode" AND status IN ('ACTIVE','PAST_DUE')
    LIMIT 1;

    IF FOUND THEN
      period_end := greatest(now(), subscription_row."currentPeriodEnd") + make_interval(days => duration_days);
      UPDATE subscriptions SET
        status = 'ACTIVE',
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
    PERFORM extend_feature_entitlement(NEW."userId", 'JOB_MATCH_PREMIUM', duration_days, NEW.id, 'SUBSCRIPTION');
    PERFORM extend_feature_entitlement(NEW."userId", 'RESUME_BOOST', duration_days, NEW.id, 'SUBSCRIPTION');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_job_match_entitlement_trigger ON payments;
DROP TRIGGER IF EXISTS payments_paid_product_benefits_trigger ON payments;
CREATE TRIGGER payments_paid_product_benefits_trigger
AFTER UPDATE OF status ON payments
FOR EACH ROW
EXECUTE FUNCTION settle_paid_product_benefits();
