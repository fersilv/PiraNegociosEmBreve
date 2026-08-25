INSERT INTO payment_products
  (code, name, description, "priceCents", enabled, "freeUses", "sortOrder", "durationDays", "billingType", benefits)
VALUES
  (
    'COMPANY_PLUS_MONTHLY',
    'PiraNegócios Empresa Plus',
    'Plano mensal para gestão operacional de vagas e acesso detalhado a candidatos pelo WhatsApp.',
    1990,
    true,
    0,
    70,
    30,
    'RECURRING',
    '[{"kind":"COMPANY_PLAN","plan":"PLUS"}]'::jsonb
  ),
  (
    'COMPANY_ELITE_MONTHLY',
    'PiraNegócios Empresa Elite',
    'Plano mensal completo para gestão de recrutamento pelo WhatsApp e elegibilidade aos destaques publicitários do PiraNegócios.',
    4990,
    true,
    0,
    75,
    30,
    'RECURRING',
    '[{"kind":"COMPANY_PLAN","plan":"ELITE"},{"kind":"AD_HIGHLIGHT_ELIGIBILITY","channels":["META","GOOGLE"]}]'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "priceCents" = EXCLUDED."priceCents",
  enabled = true,
  "durationDays" = 30,
  "billingType" = 'RECURRING',
  benefits = EXCLUDED.benefits;

CREATE TABLE IF NOT EXISTS company_plan_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  "payerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan varchar(16) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "productCode" varchar(64) NOT NULL REFERENCES payment_products(code),
  provider varchar(80) NULL,
  "providerSubscriptionId" varchar(180) NULL,
  "paymentId" uuid NULL REFERENCES payments(id) ON DELETE SET NULL,
  "currentPeriodStart" timestamptz NOT NULL DEFAULT now(),
  "currentPeriodEnd" timestamptz NOT NULL,
  "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
  "isSimulation" boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_plan_subscriptions_plan_check CHECK (plan IN ('PLUS','ELITE')),
  CONSTRAINT company_plan_subscriptions_status_check CHECK (status IN ('ACTIVE','PAST_DUE','CANCELED','EXPIRED'))
);
CREATE INDEX IF NOT EXISTS company_plan_subscriptions_status_idx
  ON company_plan_subscriptions (status, "currentPeriodEnd");
CREATE INDEX IF NOT EXISTS company_plan_subscriptions_payer_idx
  ON company_plan_subscriptions ("payerUserId", "updatedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_plan_subscriptions_provider_unique
  ON company_plan_subscriptions(provider, "providerSubscriptionId")
  WHERE "providerSubscriptionId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS company_ad_highlight_eligibility (
  "companyId" uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  eligible boolean NOT NULL DEFAULT false,
  channels jsonb NOT NULL DEFAULT '["META","GOOGLE"]'::jsonb,
  "eligibleUntil" timestamptz NULL,
  source varchar(32) NOT NULL DEFAULT 'COMPANY_ELITE',
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

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
    NULLIF(NEW.metadata->>'subscriptionId', ''),
    NULLIF(NEW.metadata->>'preapprovalId', '')
  );

  BEGIN
    company_id := NULLIF(NEW.metadata->>'companyId', '')::uuid;
  EXCEPTION WHEN others THEN
    company_id := NULL;
  END;

  -- As cobranças mensais seguintes do Pix Automático carregam o idRec e o
  -- parentPaymentId, mas não necessariamente repetem companyId. Reaproveita
  -- a assinatura já vinculada ou o pagamento original para manter a renovação.
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
        FROM payments
        WHERE id = parent_payment_id
        LIMIT 1;
      EXCEPTION WHEN others THEN
        company_id := NULL;
      END;
    END IF;
  END IF;

  IF company_id IS NULL THEN
    RETURN NEW;
  END IF;

  plan_code := CASE WHEN NEW."productCode" = 'COMPANY_ELITE_MONTHLY' THEN 'ELITE' ELSE 'PLUS' END;
  SELECT COALESCE("durationDays", 30) INTO duration_days
  FROM payment_products WHERE code = NEW."productCode";
  duration_days := COALESCE(duration_days, 30);

  SELECT plan INTO existing_plan
  FROM company_plan_subscriptions
  WHERE "companyId" = company_id
  LIMIT 1;

  IF existing_plan = plan_code THEN
    SELECT greatest(now(), "currentPeriodEnd") + make_interval(days => duration_days)
      INTO period_end
    FROM company_plan_subscriptions
    WHERE "companyId" = company_id;
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

DROP TRIGGER IF EXISTS payments_company_plan_trigger ON payments;
CREATE TRIGGER payments_company_plan_trigger
AFTER UPDATE OF status ON payments
FOR EACH ROW
EXECUTE FUNCTION settle_company_plan_payment();
