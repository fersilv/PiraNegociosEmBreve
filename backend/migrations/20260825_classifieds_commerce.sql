-- Classificados Commerce: precificação promocional, conexão de pagamentos,
-- comissão configurável e base de pedidos/agendamentos.

ALTER TABLE classified_listings
  ADD COLUMN IF NOT EXISTS "commerceConfig" jsonb NULL;

-- Mantém categorias do futuro módulo Restaurantes fora dos Classificados.
-- A regra olha apenas nomes/slugs que representam diretamente o vertical,
-- evitando bloquear categorias genéricas de equipamentos/utensílios.
CREATE OR REPLACE FUNCTION enforce_classified_category_vertical()
RETURNS trigger AS $$
DECLARE
  normalized_slug text := lower(coalesce(NEW.slug, ''));
  normalized_name text := lower(trim(coalesce(NEW.name, '')));
BEGIN
  IF normalized_slug IN (
      'restaurante','restaurantes','lanchonete','lanchonetes','pizzaria','pizzarias',
      'hamburgueria','hamburguerias','cafeteria','cafeterias','bar','bares',
      'padaria','padarias','doceria','docerias','sorveteria','sorveterias',
      'comida','comidas','delivery-de-comida','alimentacao','alimentacao-e-bebidas'
    ) OR normalized_name IN (
      'restaurante','restaurantes','lanchonete','lanchonetes','pizzaria','pizzarias',
      'hamburgueria','hamburguerias','cafeteria','cafeterias','bar','bares',
      'padaria','padarias','doceria','docerias','sorveteria','sorveterias',
      'comida','comidas','delivery de comida','alimentação','alimentação e bebidas'
    ) THEN
    NEW."isActive" := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classified_category_vertical ON classified_categories;
CREATE TRIGGER trg_classified_category_vertical
BEFORE INSERT OR UPDATE OF slug, name, "isActive" ON classified_categories
FOR EACH ROW EXECUTE FUNCTION enforce_classified_category_vertical();

UPDATE classified_categories
SET "isActive" = false, "updatedAt" = now()
WHERE lower(slug) IN (
  'restaurante','restaurantes','lanchonete','lanchonetes','pizzaria','pizzarias',
  'hamburgueria','hamburguerias','cafeteria','cafeterias','bar','bares',
  'padaria','padarias','doceria','docerias','sorveteria','sorveterias',
  'comida','comidas','delivery-de-comida','alimentacao','alimentacao-e-bebidas'
) OR lower(trim(name)) IN (
  'restaurante','restaurantes','lanchonete','lanchonetes','pizzaria','pizzarias',
  'hamburgueria','hamburguerias','cafeteria','cafeterias','bar','bares',
  'padaria','padarias','doceria','docerias','sorveteria','sorveterias',
  'comida','comidas','delivery de comida','alimentação','alimentação e bebidas'
);

CREATE TABLE IF NOT EXISTS company_classified_payment_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider varchar(24) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'CONNECTED',
  "externalUserId" varchar(160) NULL,
  "encryptedCredentials" text NOT NULL,
  scopes text NULL,
  "tokenExpiresAt" timestamptz NULL,
  "connectedByUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "connectedAt" timestamptz NOT NULL DEFAULT now(),
  "lastRefreshedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_classified_payment_connections_provider_check
    CHECK (provider IN ('MERCADO_PAGO','EFI')),
  CONSTRAINT company_classified_payment_connections_status_check
    CHECK (status IN ('CONNECTED','EXPIRED','REVOKED','ERROR')),
  CONSTRAINT company_classified_payment_connections_unique UNIQUE ("companyId", provider)
);

CREATE INDEX IF NOT EXISTS company_classified_payment_connections_company_idx
  ON company_classified_payment_connections("companyId", status);

CREATE TABLE IF NOT EXISTS company_classified_payment_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(24) NOT NULL,
  "stateHash" varchar(128) NOT NULL UNIQUE,
  "expiresAt" timestamptz NOT NULL,
  "usedAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_classified_payment_oauth_states_provider_check
    CHECK (provider IN ('MERCADO_PAGO','EFI'))
);

CREATE INDEX IF NOT EXISTS company_classified_payment_oauth_states_expiry_idx
  ON company_classified_payment_oauth_states("expiresAt") WHERE "usedAt" IS NULL;

-- Comissão da plataforma. Nenhuma porcentagem é inventada nesta migration.
-- A regra por empresa (CUSTOM) tem precedência sobre a regra do plano.
CREATE TABLE IF NOT EXISTS classified_commerce_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope varchar(16) NOT NULL,
  plan varchar(16) NULL,
  "companyId" uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  "rateBps" integer NULL,
  "minimumFeeCents" integer NOT NULL DEFAULT 0,
  "maximumFeeCents" integer NULL,
  enabled boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_commerce_fee_rules_scope_check CHECK (scope IN ('PLAN','COMPANY')),
  CONSTRAINT classified_commerce_fee_rules_plan_check CHECK (plan IS NULL OR plan IN ('FREE','PLUS','ELITE')),
  CONSTRAINT classified_commerce_fee_rules_rate_check CHECK ("rateBps" IS NULL OR ("rateBps" >= 0 AND "rateBps" <= 10000)),
  CONSTRAINT classified_commerce_fee_rules_min_check CHECK ("minimumFeeCents" >= 0),
  CONSTRAINT classified_commerce_fee_rules_max_check CHECK ("maximumFeeCents" IS NULL OR "maximumFeeCents" >= "minimumFeeCents"),
  CONSTRAINT classified_commerce_fee_rules_shape_check CHECK (
    (scope = 'PLAN' AND plan IS NOT NULL AND "companyId" IS NULL)
    OR (scope = 'COMPANY' AND "companyId" IS NOT NULL AND plan IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS classified_commerce_fee_rules_plan_uq
  ON classified_commerce_fee_rules(plan) WHERE scope = 'PLAN';
CREATE UNIQUE INDEX IF NOT EXISTS classified_commerce_fee_rules_company_uq
  ON classified_commerce_fee_rules("companyId") WHERE scope = 'COMPANY';

CREATE TABLE IF NOT EXISTS classified_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE RESTRICT,
  "buyerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  "unitPriceCents" integer NOT NULL,
  "discountCents" integer NOT NULL DEFAULT 0,
  "totalCents" integer NOT NULL,
  "platformFeeCents" integer NOT NULL DEFAULT 0,
  "sellerNetCents" integer NOT NULL,
  "paymentProvider" varchar(24) NULL,
  "providerPaymentId" varchar(180) NULL,
  "providerCheckoutId" varchar(180) NULL,
  "checkoutUrl" text NULL,
  "paymentMethod" varchar(32) NULL,
  "paymentStatus" varchar(24) NOT NULL DEFAULT 'PENDING',
  status varchar(24) NOT NULL DEFAULT 'CREATED',
  "fulfillmentMode" varchar(20) NOT NULL DEFAULT 'PICKUP',
  "fulfillmentData" jsonb NULL,
  "paidAt" timestamptz NULL,
  "readyAt" timestamptz NULL,
  "completedAt" timestamptz NULL,
  "canceledAt" timestamptz NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_orders_quantity_check CHECK (quantity > 0),
  CONSTRAINT classified_orders_money_check CHECK (
    "unitPriceCents" >= 0 AND "discountCents" >= 0 AND "totalCents" >= 0
    AND "platformFeeCents" >= 0 AND "sellerNetCents" >= 0
  ),
  CONSTRAINT classified_orders_provider_check CHECK ("paymentProvider" IS NULL OR "paymentProvider" IN ('MERCADO_PAGO','EFI','DIRECT')),
  CONSTRAINT classified_orders_payment_status_check CHECK ("paymentStatus" IN ('PENDING','APPROVED','REJECTED','REFUNDED','CANCELED','IN_PROCESS')),
  CONSTRAINT classified_orders_status_check CHECK (status IN ('CREATED','PAID','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','COMPLETED','CANCELED')),
  CONSTRAINT classified_orders_fulfillment_check CHECK ("fulfillmentMode" IN ('PICKUP','DELIVERY'))
);

CREATE INDEX IF NOT EXISTS classified_orders_company_idx
  ON classified_orders("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_orders_buyer_idx
  ON classified_orders("buyerUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_orders_listing_idx
  ON classified_orders("listingId", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS classified_orders_provider_payment_uq
  ON classified_orders("paymentProvider", "providerPaymentId")
  WHERE "providerPaymentId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS classified_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES classified_orders(id) ON DELETE CASCADE,
  type varchar(40) NOT NULL,
  "fromStatus" varchar(24) NULL,
  "toStatus" varchar(24) NULL,
  "actorUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classified_order_events_order_idx
  ON classified_order_events("orderId", "createdAt" ASC);

-- Estrutura genérica para serviços. Verticais específicos (barbearia, banho e tosa etc.)
-- podem especializar esta base no futuro sem contaminar o Classificados principal.
CREATE TABLE IF NOT EXISTS classified_service_booking_settings (
  "listingId" uuid PRIMARY KEY REFERENCES classified_listings(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  "slotMinutes" integer NOT NULL DEFAULT 60,
  "minimumAdvanceMinutes" integer NOT NULL DEFAULT 60,
  "maximumAdvanceDays" integer NOT NULL DEFAULT 90,
  "requiresPayment" boolean NOT NULL DEFAULT false,
  "rescheduleAllowed" boolean NOT NULL DEFAULT true,
  "rescheduleDeadlineHours" integer NOT NULL DEFAULT 24,
  "rescheduleFeeCents" integer NOT NULL DEFAULT 0,
  "reminderOffsetsMinutes" jsonb NOT NULL DEFAULT '[1440,120]'::jsonb,
  availability jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_service_booking_slot_check CHECK ("slotMinutes" BETWEEN 5 AND 1440),
  CONSTRAINT classified_service_booking_money_check CHECK ("rescheduleFeeCents" >= 0)
);

CREATE TABLE IF NOT EXISTS classified_service_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "customerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status varchar(24) NOT NULL DEFAULT 'REQUESTED',
  "amountCents" integer NULL,
  description text NULL,
  "validUntil" timestamptz NULL,
  "paymentRequired" boolean NOT NULL DEFAULT false,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_service_quotes_status_check CHECK (status IN ('REQUESTED','QUOTED','ACCEPTED','REJECTED','EXPIRED','CANCELED')),
  CONSTRAINT classified_service_quotes_amount_check CHECK ("amountCents" IS NULL OR "amountCents" >= 0)
);

CREATE INDEX IF NOT EXISTS classified_service_quotes_company_idx
  ON classified_service_quotes("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_service_quotes_customer_idx
  ON classified_service_quotes("customerUserId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS classified_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quoteId" uuid NULL REFERENCES classified_service_quotes(id) ON DELETE SET NULL,
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "customerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status varchar(24) NOT NULL DEFAULT 'PENDING',
  "startsAt" timestamptz NOT NULL,
  "endsAt" timestamptz NOT NULL,
  "paymentStatus" varchar(24) NOT NULL DEFAULT 'NOT_REQUIRED',
  "rescheduleFeeCents" integer NOT NULL DEFAULT 0,
  "rescheduleCount" integer NOT NULL DEFAULT 0,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_appointments_status_check CHECK (status IN ('PENDING','CONFIRMED','COMPLETED','CANCELED','NO_SHOW')),
  CONSTRAINT classified_appointments_payment_check CHECK ("paymentStatus" IN ('NOT_REQUIRED','PENDING','APPROVED','REFUNDED','CANCELED')),
  CONSTRAINT classified_appointments_period_check CHECK ("endsAt" > "startsAt"),
  CONSTRAINT classified_appointments_reschedule_fee_check CHECK ("rescheduleFeeCents" >= 0)
);

CREATE INDEX IF NOT EXISTS classified_appointments_company_calendar_idx
  ON classified_appointments("companyId", "startsAt");
CREATE INDEX IF NOT EXISTS classified_appointments_customer_idx
  ON classified_appointments("customerUserId", "startsAt" DESC);
