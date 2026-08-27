-- Planos empresariais podem ser comprados como assinatura por Pix Automático
-- ou como acesso avulso por Pix. O acesso concedido é o mesmo durante o
-- período do produto; apenas a renovação muda.

CREATE OR REPLACE FUNCTION settle_company_plan_payment()
RETURNS trigger AS $$
DECLARE
  company_id uuid;
  plan_code varchar(16);
  purchase_mode varchar(16);
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

  purchase_mode := COALESCE(
    NULLIF(NEW."purchaseMode", ''),
    NULLIF(NEW.metadata->>'purchaseMode', ''),
    'SUBSCRIPTION'
  );
  IF purchase_mode NOT IN ('ONE_TIME','SUBSCRIPTION') THEN
    purchase_mode := 'SUBSCRIPTION';
  END IF;

  IF purchase_mode = 'SUBSCRIPTION' THEN
    provider_subscription_id := COALESCE(
      NULLIF(NEW.metadata->>'efiRecurrenceId', ''),
      NULLIF(NEW.metadata->>'subscriptionId', ''),
      NULLIF(NEW.metadata->>'preapprovalId', '')
    );
  ELSE
    provider_subscription_id := NULL;
  END IF;

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
     provider_subscription_id, NEW.id, now(), period_end,
     purchase_mode = 'ONE_TIME', NEW."isSimulation",
     COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('purchaseMode', purchase_mode), now())
  ON CONFLICT ("companyId") DO UPDATE SET
    "payerUserId" = EXCLUDED."payerUserId",
    plan = EXCLUDED.plan,
    status = 'ACTIVE',
    "productCode" = EXCLUDED."productCode",
    provider = EXCLUDED.provider,
    "providerSubscriptionId" = CASE
      WHEN purchase_mode = 'SUBSCRIPTION'
        THEN COALESCE(EXCLUDED."providerSubscriptionId", company_plan_subscriptions."providerSubscriptionId")
      ELSE NULL
    END,
    "paymentId" = EXCLUDED."paymentId",
    "currentPeriodStart" = now(),
    "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
    "cancelAtPeriodEnd" = (purchase_mode = 'ONE_TIME'),
    "isSimulation" = EXCLUDED."isSimulation",
    metadata = company_plan_subscriptions.metadata || EXCLUDED.metadata || jsonb_build_object('purchaseMode', purchase_mode),
    "updatedAt" = now();

  UPDATE company_plan_trials
  SET status = 'EXPIRED', "updatedAt" = now()
  WHERE "companyId" = company_id AND status = 'ACTIVE';

  INSERT INTO company_ad_highlight_eligibility
    ("companyId", eligible, channels, "eligibleUntil", source, "updatedAt")
  VALUES
    (company_id, plan_code = 'ELITE', '["META","GOOGLE"]'::jsonb,
     CASE WHEN plan_code = 'ELITE' THEN period_end ELSE NULL END,
     CASE WHEN purchase_mode = 'ONE_TIME' THEN 'COMPANY_ELITE_ONE_TIME' ELSE 'COMPANY_ELITE' END,
     now())
  ON CONFLICT ("companyId") DO UPDATE SET
    eligible = EXCLUDED.eligible,
    channels = EXCLUDED.channels,
    "eligibleUntil" = EXCLUDED."eligibleUntil",
    source = EXCLUDED.source,
    "updatedAt" = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
