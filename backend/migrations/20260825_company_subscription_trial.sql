-- Elite trial is granted only after a Plus/Elite recurring subscription is authorized.
-- The trial affects WhatsApp concierge entitlements only; web dashboard operations stay untouched.

CREATE TABLE IF NOT EXISTS company_plan_trials (
  "companyId" uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  "startedBy" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL DEFAULT 'ACTIVE',
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "endsAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_plan_trials ADD COLUMN IF NOT EXISTS "targetPlan" varchar(16) NULL;
ALTER TABLE company_plan_trials ADD COLUMN IF NOT EXISTS provider varchar(80) NULL;
ALTER TABLE company_plan_trials ADD COLUMN IF NOT EXISTS "providerSubscriptionId" varchar(180) NULL;
ALTER TABLE company_plan_trials ADD COLUMN IF NOT EXISTS "paymentId" uuid NULL REFERENCES payments(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_plan_trials_target_plan_check'
  ) THEN
    ALTER TABLE company_plan_trials
      ADD CONSTRAINT company_plan_trials_target_plan_check
      CHECK ("targetPlan" IS NULL OR "targetPlan" IN ('PLUS','ELITE'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS company_plan_trials_payment_unique
  ON company_plan_trials("paymentId") WHERE "paymentId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_plan_trials_provider_subscription_idx
  ON company_plan_trials(provider, "providerSubscriptionId")
  WHERE "providerSubscriptionId" IS NOT NULL;

-- Existing trial rows created before subscription-only trials are invalid because
-- they may have been granted without a recurring subscription authorization.
-- Keep their audit record, but do not let them grant access.
UPDATE company_plan_trials
SET status = 'EXPIRED', "updatedAt" = now()
WHERE "paymentId" IS NULL AND status = 'ACTIVE';

-- Mercado Pago stores the recurring id under mercadoPagoSubscriptionId.
-- Keep the company-plan settlement trigger aware of that identifier so renewals
-- remain tied to the correct company.
CREATE OR REPLACE FUNCTION settle_company_plan_payment()
RETURNS trigger AS $$
DECLARE
  company_id uuid;
  plan_code varchar(16);
  duration_days integer := 30;
  period_end timestamptz;
  existing_plan varchar(16);
  provider_subscription_id varchar(180);
  parent_payment_id uuid;
BEGIN
  IF NEW.status <> 'PAID' OR OLD.status = 'PAID' THEN
    RETURN NEW;
  END IF;

  IF NEW."productCode" NOT IN ('COMPANY_PLUS_MONTHLY','COMPANY_ELITE_MONTHLY') THEN
    RETURN NEW;
  END IF;

  provider_subscription_id := COALESCE(
    NULLIF(NEW.metadata->>'efiRecurrenceId', ''),
    NULLIF(NEW.metadata->>'mercadoPagoSubscriptionId', ''),
    NULLIF(NEW.metadata->>'subscriptionId', ''),
    NULLIF(NEW.metadata->>'preapprovalId', '')
  );

  BEGIN
    company_id := NULLIF(NEW.metadata->>'companyId', '')::uuid;
  EXCEPTION WHEN others THEN
    company_id := NULL;
  END;

  IF company_id IS NULL AND provider_subscription_id IS NOT NULL THEN
    SELECT "companyId" INTO company_id
    FROM company_plan_trials
    WHERE "providerSubscriptionId" = provider_subscription_id
    LIMIT 1;
  END IF;

  IF company_id IS NULL AND provider_subscription_id IS NOT NULL THEN
    SELECT "companyId" INTO company_id
    FROM company_plan_subscriptions
    WHERE "providerSubscriptionId" = provider_subscription_id
    LIMIT 1;
  END IF;

  IF company_id IS NULL THEN
    BEGIN
      parent_payment_id := NULLIF(NEW.metadata->>'parentPaymentId', '')::uuid;
    EXCEPTION WHEN others THEN
      parent_payment_id := NULL;
    END;
    IF parent_payment_id IS NOT NULL THEN
      BEGIN
        SELECT NULLIF(metadata->>'companyId', '')::uuid INTO company_id
        FROM payments WHERE id = parent_payment_id LIMIT 1;
      EXCEPTION WHEN others THEN
        company_id := NULL;
      END;
    END IF;
  END IF;

  IF company_id IS NULL THEN RETURN NEW; END IF;

  plan_code := CASE WHEN NEW."productCode" = 'COMPANY_ELITE_MONTHLY' THEN 'ELITE' ELSE 'PLUS' END;
  SELECT COALESCE("durationDays", 30) INTO duration_days
  FROM payment_products WHERE code = NEW."productCode";
  duration_days := COALESCE(duration_days, 30);

  SELECT plan INTO existing_plan
  FROM company_plan_subscriptions WHERE "companyId" = company_id LIMIT 1;

  IF existing_plan = plan_code THEN
    SELECT greatest(now(), "currentPeriodEnd") + make_interval(days => duration_days)
      INTO period_end
    FROM company_plan_subscriptions WHERE "companyId" = company_id;
  ELSE
    period_end := now() + make_interval(days => duration_days);
  END IF;
  period_end := COALESCE(period_end, now() + make_interval(days => duration_days));

  INSERT INTO company_plan_subscriptions
    ("companyId", "payerUserId", plan, status, "productCode", provider,
     "providerSubscriptionId", "paymentId", "currentPeriodStart", "currentPeriodEnd",
     "cancelAtPeriodEnd", "isSimulation", metadata, "updatedAt")
  VALUES
    (company_id, NEW."userId", plan_code, 'ACTIVE', NEW."productCode", NEW.provider,
     provider_subscription_id, NEW.id, now(), period_end, false, NEW."isSimulation",
     COALESCE(NEW.metadata, '{}'::jsonb), now())
  ON CONFLICT ("companyId") DO UPDATE SET
    "payerUserId" = EXCLUDED."payerUserId",
    plan = EXCLUDED.plan,
    status = 'ACTIVE',
    "productCode" = EXCLUDED."productCode",
    provider = EXCLUDED.provider,
    "providerSubscriptionId" = COALESCE(EXCLUDED."providerSubscriptionId", company_plan_subscriptions."providerSubscriptionId"),
    "paymentId" = EXCLUDED."paymentId",
    "currentPeriodStart" = now(),
    "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
    "cancelAtPeriodEnd" = false,
    "isSimulation" = EXCLUDED."isSimulation",
    metadata = company_plan_subscriptions.metadata || EXCLUDED.metadata,
    "updatedAt" = now();

  UPDATE company_plan_trials
  SET status = 'EXPIRED', "updatedAt" = now()
  WHERE "companyId" = company_id AND status = 'ACTIVE';

  INSERT INTO company_ad_highlight_eligibility
    ("companyId", eligible, channels, "eligibleUntil", source, "updatedAt")
  VALUES
    (company_id, plan_code = 'ELITE', '["META","GOOGLE"]'::jsonb,
     CASE WHEN plan_code = 'ELITE' THEN period_end ELSE NULL END,
     'COMPANY_ELITE', now())
  ON CONFLICT ("companyId") DO UPDATE SET
    eligible = EXCLUDED.eligible,
    channels = EXCLUDED.channels,
    "eligibleUntil" = EXCLUDED."eligibleUntil",
    source = EXCLUDED.source,
    "updatedAt" = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
