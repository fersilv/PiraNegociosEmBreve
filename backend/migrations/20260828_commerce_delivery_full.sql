-- Comércio, carrinho, entregas e orçamentos — Fases 1 a 5
-- Estruturas aditivas e compatíveis com pedidos unitários já existentes.

-- FASE 1: configuração comercial global e endereços
CREATE TABLE IF NOT EXISTS company_commerce_settings (
  "companyId" uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  "onlinePaymentsEnabled" boolean NOT NULL DEFAULT false,
  "pixEnabled" boolean NOT NULL DEFAULT true,
  "cardEnabled" boolean NOT NULL DEFAULT true,
  "defaultPixDiscountBps" integer NOT NULL DEFAULT 0,
  "defaultMaxInstallments" integer NOT NULL DEFAULT 1,
  "defaultInterestFreeInstallments" integer NOT NULL DEFAULT 0,
  "pickupEnabled" boolean NOT NULL DEFAULT true,
  "ownDeliveryEnabled" boolean NOT NULL DEFAULT false,
  "platformPartnersEnabled" boolean NOT NULL DEFAULT false,
  "defaultStockTracking" boolean NOT NULL DEFAULT false,
  "defaultLowStockThreshold" integer NULL,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updatedByUserId" varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_commerce_settings_discount_check CHECK ("defaultPixDiscountBps" BETWEEN 0 AND 10000),
  CONSTRAINT company_commerce_settings_installments_check CHECK ("defaultMaxInstallments" BETWEEN 1 AND 24),
  CONSTRAINT company_commerce_settings_interest_free_check CHECK ("defaultInterestFreeInstallments" BETWEEN 0 AND "defaultMaxInstallments"),
  CONSTRAINT company_commerce_settings_low_stock_check CHECK ("defaultLowStockThreshold" IS NULL OR "defaultLowStockThreshold" >= 0)
);

CREATE TABLE IF NOT EXISTS delivery_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(80) NOT NULL DEFAULT 'Casa',
  "zipCode" varchar(20) NOT NULL,
  street varchar(180) NOT NULL,
  number varchar(40) NOT NULL,
  complement varchar(160) NULL,
  neighborhood varchar(140) NOT NULL,
  city varchar(120) NOT NULL,
  state varchar(2) NOT NULL,
  "placeId" varchar(255) NULL,
  latitude numeric(10,7) NULL,
  longitude numeric(10,7) NULL,
  "locationAccuracyMeters" integer NULL,
  "isDefault" boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_addresses_lat_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT delivery_addresses_lng_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT delivery_addresses_accuracy_check CHECK ("locationAccuracyMeters" IS NULL OR "locationAccuracyMeters" >= 0)
);
CREATE INDEX IF NOT EXISTS delivery_addresses_user_idx ON delivery_addresses("userId", active, "updatedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_addresses_default_uq ON delivery_addresses("userId") WHERE "isDefault" = true AND active = true;

CREATE TABLE IF NOT EXISTS company_fulfillment_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  "zipCode" varchar(20) NOT NULL,
  street varchar(180) NOT NULL,
  number varchar(40) NOT NULL,
  complement varchar(160) NULL,
  neighborhood varchar(140) NOT NULL,
  city varchar(120) NOT NULL,
  state varchar(2) NOT NULL,
  "placeId" varchar(255) NULL,
  latitude numeric(10,7) NULL,
  longitude numeric(10,7) NULL,
  "allowsPickup" boolean NOT NULL DEFAULT true,
  "allowsDeliveryOrigin" boolean NOT NULL DEFAULT true,
  "isDefaultPickup" boolean NOT NULL DEFAULT false,
  "isDefaultDeliveryOrigin" boolean NOT NULL DEFAULT false,
  "pickupInstructions" text NULL,
  "businessHours" jsonb NULL,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_fulfillment_locations_lat_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT company_fulfillment_locations_lng_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS company_fulfillment_locations_company_idx ON company_fulfillment_locations("companyId", active, name);
CREATE UNIQUE INDEX IF NOT EXISTS company_fulfillment_default_pickup_uq ON company_fulfillment_locations("companyId") WHERE "isDefaultPickup" = true AND active = true;
CREATE UNIQUE INDEX IF NOT EXISTS company_fulfillment_default_origin_uq ON company_fulfillment_locations("companyId") WHERE "isDefaultDeliveryOrigin" = true AND active = true;

CREATE TABLE IF NOT EXISTS classified_listing_shipping (
  "listingId" uuid PRIMARY KEY REFERENCES classified_listings(id) ON DELETE CASCADE,
  "inheritCompanySettings" boolean NOT NULL DEFAULT true,
  "originLocationId" uuid NULL REFERENCES company_fulfillment_locations(id) ON DELETE SET NULL,
  "weightGrams" integer NULL,
  "lengthCm" numeric(10,2) NULL,
  "widthCm" numeric(10,2) NULL,
  "heightCm" numeric(10,2) NULL,
  "volumeCm3" numeric(16,2) NULL,
  "disableLocalPartners" boolean NOT NULL DEFAULT false,
  "handlingType" varchar(32) NULL,
  "handlingNotes" varchar(500) NULL,
  "overrides" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_listing_shipping_weight_check CHECK ("weightGrams" IS NULL OR "weightGrams" > 0),
  CONSTRAINT classified_listing_shipping_dims_check CHECK (
    ("lengthCm" IS NULL OR "lengthCm" > 0) AND
    ("widthCm" IS NULL OR "widthCm" > 0) AND
    ("heightCm" IS NULL OR "heightCm" > 0) AND
    ("volumeCm3" IS NULL OR "volumeCm3" > 0)
  ),
  CONSTRAINT classified_listing_shipping_handling_check CHECK ("handlingType" IS NULL OR "handlingType" IN ('STANDARD','FRAGILE','REFRIGERATED','LARGE','SPECIAL'))
);

-- FASE 2: parceiros e cotação
CREATE TABLE IF NOT EXISTS delivery_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  type varchar(32) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  priority integer NOT NULL DEFAULT 100,
  "cities" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "maxWeightGrams" integer NULL,
  "maxLengthCm" numeric(10,2) NULL,
  "maxWidthCm" numeric(10,2) NULL,
  "maxHeightCm" numeric(10,2) NULL,
  "maxVolumeCm3" numeric(16,2) NULL,
  "supportsRoundTrip" boolean NOT NULL DEFAULT false,
  "channelType" varchar(32) NOT NULL DEFAULT 'WHATSAPP_INDIVIDUAL',
  "channelTarget" varchar(255) NULL,
  "pixKey" varchar(255) NULL,
  "payoutDeadlineHours" integer NOT NULL DEFAULT 24,
  "supportsPrepaidBalance" boolean NOT NULL DEFAULT false,
  "contactName" varchar(160) NULL,
  "contactPhone" varchar(40) NULL,
  notes text NULL,
  "createdByUserId" varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_partners_type_check CHECK (type IN ('MOTOBOY','BIKE','TRANSPORTADORA','MELHOR_ENVIO')),
  CONSTRAINT delivery_partners_status_check CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  CONSTRAINT delivery_partners_channel_check CHECK ("channelType" IN ('WHATSAPP_INDIVIDUAL','WHATSAPP_GROUP_INTEGRATED','WHATSAPP_GROUP_MANUAL','INTEGRATION')),
  CONSTRAINT delivery_partners_weight_check CHECK ("maxWeightGrams" IS NULL OR "maxWeightGrams" > 0),
  CONSTRAINT delivery_partners_payout_check CHECK ("payoutDeadlineHours" BETWEEN 1 AND 720)
);
CREATE INDEX IF NOT EXISTS delivery_partners_status_priority_idx ON delivery_partners(status, priority, name);

CREATE TABLE IF NOT EXISTS delivery_partner_rate_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partnerId" uuid NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name varchar(160) NOT NULL,
  "startsAt" timestamptz NOT NULL DEFAULT now(),
  "endsAt" timestamptz NULL,
  active boolean NOT NULL DEFAULT true,
  "createdByUserId" varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_partner_rate_tables_period_check CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  CONSTRAINT delivery_partner_rate_tables_version_uq UNIQUE ("partnerId", version)
);
CREATE INDEX IF NOT EXISTS delivery_partner_rate_tables_active_idx ON delivery_partner_rate_tables("partnerId", active, "startsAt" DESC);

CREATE TABLE IF NOT EXISTS delivery_partner_rate_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rateTableId" uuid NOT NULL REFERENCES delivery_partner_rate_tables(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  city varchar(120) NULL,
  state varchar(2) NULL,
  neighborhood varchar(140) NULL,
  "zipCodeStart" varchar(20) NULL,
  "zipCodeEnd" varchar(20) NULL,
  "minDistanceMeters" integer NULL,
  "maxDistanceMeters" integer NULL,
  "fixedPriceCents" integer NULL,
  "minimumPriceCents" integer NOT NULL DEFAULT 0,
  "perKmCents" integer NOT NULL DEFAULT 0,
  "roundTripAdditionalCents" integer NOT NULL DEFAULT 0,
  "weightAdditionalPerKgCents" integer NOT NULL DEFAULT 0,
  "maxWeightGrams" integer NULL,
  "maxLengthCm" numeric(10,2) NULL,
  "maxWidthCm" numeric(10,2) NULL,
  "maxHeightCm" numeric(10,2) NULL,
  "maxVolumeCm3" numeric(16,2) NULL,
  "estimatedMinutes" integer NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_partner_rate_rules_distance_check CHECK (
    ("minDistanceMeters" IS NULL OR "minDistanceMeters" >= 0) AND
    ("maxDistanceMeters" IS NULL OR "maxDistanceMeters" >= COALESCE("minDistanceMeters", 0))
  ),
  CONSTRAINT delivery_partner_rate_rules_money_check CHECK (
    ("fixedPriceCents" IS NULL OR "fixedPriceCents" >= 0) AND
    "minimumPriceCents" >= 0 AND "perKmCents" >= 0 AND
    "roundTripAdditionalCents" >= 0 AND "weightAdditionalPerKgCents" >= 0
  )
);
CREATE INDEX IF NOT EXISTS delivery_partner_rate_rules_table_idx ON delivery_partner_rate_rules("rateTableId", priority, id);

CREATE TABLE IF NOT EXISTS company_delivery_partner_preferences (
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  "partnerId" uuid NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  "settlementMode" varchar(20) NOT NULL DEFAULT 'INVOICE',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("companyId", "partnerId"),
  CONSTRAINT company_delivery_partner_preferences_mode_check CHECK ("settlementMode" IN ('PREPAID','INVOICE'))
);

CREATE TABLE IF NOT EXISTS delivery_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "buyerUserId" varchar NULL REFERENCES users(id) ON DELETE SET NULL,
  "originLocationId" uuid NULL REFERENCES company_fulfillment_locations(id) ON DELETE SET NULL,
  "destinationAddressId" uuid NULL REFERENCES delivery_addresses(id) ON DELETE SET NULL,
  "partnerId" uuid NULL REFERENCES delivery_partners(id) ON DELETE SET NULL,
  "rateTableId" uuid NULL REFERENCES delivery_partner_rate_tables(id) ON DELETE SET NULL,
  "rateRuleId" uuid NULL REFERENCES delivery_partner_rate_rules(id) ON DELETE SET NULL,
  mode varchar(20) NOT NULL,
  "serviceType" varchar(40) NOT NULL DEFAULT 'LOCAL',
  "amountCents" integer NOT NULL,
  "partnerPayableCents" integer NOT NULL,
  "estimatedMinutes" integer NULL,
  "distanceMeters" integer NULL,
  "eligible" boolean NOT NULL DEFAULT true,
  "ineligibilityReason" varchar(500) NULL,
  "inputSnapshot" jsonb NOT NULL,
  "quoteSnapshot" jsonb NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'QUOTED',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_quotes_mode_check CHECK (mode IN ('DELIVERY','PICKUP','ROUND_TRIP')),
  CONSTRAINT delivery_quotes_status_check CHECK (status IN ('QUOTED','SELECTED','EXPIRED','CONSUMED','CANCELED')),
  CONSTRAINT delivery_quotes_money_check CHECK ("amountCents" >= 0 AND "partnerPayableCents" >= 0)
);
CREATE INDEX IF NOT EXISTS delivery_quotes_company_created_idx ON delivery_quotes("companyId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS delivery_quotes_expiry_idx ON delivery_quotes("expiresAt") WHERE status IN ('QUOTED','SELECTED');

CREATE TABLE IF NOT EXISTS delivery_quote_cache (
  "cacheKey" varchar(128) PRIMARY KEY,
  "rateTableId" uuid NULL,
  "quoteSnapshot" jsonb NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_quote_cache_expiry_idx ON delivery_quote_cache("expiresAt");

-- FASE 3: carrinho e pedido multi-item
CREATE TABLE IF NOT EXISTS classified_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "buyerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "selectedAddressId" uuid NULL REFERENCES delivery_addresses(id) ON DELETE SET NULL,
  "selectedQuoteId" uuid NULL REFERENCES delivery_quotes(id) ON DELETE SET NULL,
  "fulfillmentMode" varchar(20) NOT NULL DEFAULT 'PICKUP',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_carts_status_check CHECK (status IN ('ACTIVE','CONVERTED','ABANDONED')),
  CONSTRAINT classified_carts_fulfillment_check CHECK ("fulfillmentMode" IN ('PICKUP','DELIVERY','ROUND_TRIP'))
);
CREATE UNIQUE INDEX IF NOT EXISTS classified_carts_active_user_uq ON classified_carts("buyerUserId") WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS classified_carts_company_idx ON classified_carts("companyId", status, "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS classified_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cartId" uuid NOT NULL REFERENCES classified_carts(id) ON DELETE CASCADE,
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_cart_items_quantity_check CHECK (quantity BETWEEN 1 AND 999),
  CONSTRAINT classified_cart_items_uq UNIQUE ("cartId", "listingId")
);
CREATE INDEX IF NOT EXISTS classified_cart_items_cart_idx ON classified_cart_items("cartId", "createdAt");

CREATE TABLE IF NOT EXISTS classified_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES classified_orders(id) ON DELETE RESTRICT,
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  "unitPriceCents" integer NOT NULL,
  "discountCents" integer NOT NULL DEFAULT 0,
  "totalCents" integer NOT NULL,
  "titleSnapshot" varchar(180) NOT NULL,
  "listingSnapshot" jsonb NOT NULL,
  "stockReserved" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT classified_order_items_money_check CHECK ("unitPriceCents" >= 0 AND "discountCents" >= 0 AND "totalCents" >= 0),
  CONSTRAINT classified_order_items_uq UNIQUE ("orderId", "listingId")
);
CREATE INDEX IF NOT EXISTS classified_order_items_order_idx ON classified_order_items("orderId", id);
CREATE INDEX IF NOT EXISTS classified_order_items_listing_idx ON classified_order_items("listingId", "orderId");

ALTER TABLE classified_orders
  ADD COLUMN IF NOT EXISTS "cartId" uuid NULL REFERENCES classified_carts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "deliveryAddressSnapshot" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "fulfillmentLocationSnapshot" jsonb NULL;

-- Materializa pedidos unitários existentes como um item, sem reescrever valores históricos.
INSERT INTO classified_order_items
  ("orderId","listingId",quantity,"unitPriceCents","discountCents","totalCents","titleSnapshot","listingSnapshot","stockReserved")
SELECT o.id,o."listingId",o.quantity,o."unitPriceCents",o."discountCents",o."totalCents",
       COALESCE(l.title,'Produto'),
       jsonb_build_object('listingId',o."listingId",'title',l.title,'legacy',true),
       o."stockReserved"
FROM classified_orders o
LEFT JOIN classified_listings l ON l.id=o."listingId"
WHERE NOT EXISTS (SELECT 1 FROM classified_order_items oi WHERE oi."orderId"=o.id)
ON CONFLICT ("orderId","listingId") DO NOTHING;

-- FASE 4: despacho, saldo, faturas e repasses
CREATE TABLE IF NOT EXISTS delivery_partner_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL REFERENCES classified_orders(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "partnerId" uuid NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
  "quoteId" uuid NULL REFERENCES delivery_quotes(id) ON DELETE SET NULL,
  status varchar(28) NOT NULL DEFAULT 'CREATED',
  "pickupSnapshot" jsonb NOT NULL,
  "destinationSnapshot" jsonb NOT NULL,
  "amountCents" integer NOT NULL,
  "partnerPayableCents" integer NOT NULL,
  "settlementMode" varchar(20) NOT NULL DEFAULT 'INVOICE',
  "dispatchChannel" varchar(32) NULL,
  "dispatchReference" varchar(255) NULL,
  "calledAt" timestamptz NULL,
  "acceptedAt" timestamptz NULL,
  "pickedUpAt" timestamptz NULL,
  "deliveredAt" timestamptz NULL,
  "canceledAt" timestamptz NULL,
  "problemAt" timestamptz NULL,
  "createdByUserId" varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_partner_jobs_status_check CHECK (status IN ('CREATED','CALLED','ACCEPTED','PICKED_UP','IN_TRANSIT','DELIVERED','CANCELED','PROBLEM')),
  CONSTRAINT delivery_partner_jobs_settlement_check CHECK ("settlementMode" IN ('PREPAID','INVOICE','ONLINE_PAYMENT')), 
  CONSTRAINT delivery_partner_jobs_money_check CHECK ("amountCents" >= 0 AND "partnerPayableCents" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_partner_jobs_active_order_uq ON delivery_partner_jobs("orderId") WHERE status NOT IN ('CANCELED');
CREATE INDEX IF NOT EXISTS delivery_partner_jobs_company_idx ON delivery_partner_jobs("companyId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS delivery_partner_jobs_partner_idx ON delivery_partner_jobs("partnerId", status, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS delivery_partner_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId" uuid NOT NULL REFERENCES delivery_partner_jobs(id) ON DELETE RESTRICT,
  action varchar(64) NOT NULL,
  "fromStatus" varchar(28) NULL,
  "toStatus" varchar(28) NULL,
  "actorUserId" varchar NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_partner_job_events_job_idx ON delivery_partner_job_events("jobId", "createdAt");

CREATE TABLE IF NOT EXISTS delivery_partner_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partnerId" uuid NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
  "companyId" uuid NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "jobId" uuid NULL REFERENCES delivery_partner_jobs(id) ON DELETE RESTRICT,
  type varchar(32) NOT NULL,
  "amountCents" bigint NOT NULL,
  "referenceType" varchar(48) NOT NULL,
  "referenceId" varchar(180) NOT NULL,
  description varchar(500) NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_partner_ledger_type_check CHECK (type IN ('PAYABLE','PAYOUT','REVERSAL','ADJUSTMENT')),
  CONSTRAINT delivery_partner_ledger_amount_check CHECK ("amountCents" <> 0)
);
CREATE INDEX IF NOT EXISTS delivery_partner_ledger_partner_idx ON delivery_partner_ledger_entries("partnerId", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_partner_ledger_reference_uq ON delivery_partner_ledger_entries(type,"referenceType","referenceId");

CREATE TABLE IF NOT EXISTS company_delivery_wallets (
  "companyId" uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  "balanceCents" bigint NOT NULL DEFAULT 0,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_delivery_wallet_balance_check CHECK ("balanceCents" >= 0)
);

CREATE TABLE IF NOT EXISTS company_delivery_wallet_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  type varchar(24) NOT NULL,
  "amountCents" bigint NOT NULL,
  "balanceAfterCents" bigint NOT NULL,
  "referenceType" varchar(48) NOT NULL,
  "referenceId" varchar(180) NOT NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_delivery_wallet_movements_type_check CHECK (type IN ('TOPUP','DELIVERY_DEBIT','REFUND','ADJUSTMENT')),
  CONSTRAINT company_delivery_wallet_movements_amount_check CHECK ("amountCents" <> 0 AND "balanceAfterCents" >= 0)
);
CREATE INDEX IF NOT EXISTS company_delivery_wallet_movements_company_idx ON company_delivery_wallet_movements("companyId", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS company_delivery_wallet_movements_reference_uq ON company_delivery_wallet_movements(type,"referenceType","referenceId");

CREATE TABLE IF NOT EXISTS company_delivery_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "jobId" uuid NULL REFERENCES delivery_partner_jobs(id) ON DELETE RESTRICT,
  status varchar(24) NOT NULL DEFAULT 'OPEN',
  "amountCents" bigint NOT NULL,
  "dueAt" timestamptz NOT NULL,
  "pixProvider" varchar(32) NULL,
  "pixPaymentId" varchar(180) NULL,
  "pixCopyPaste" text NULL,
  "paidAt" timestamptz NULL,
  "canceledAt" timestamptz NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_delivery_invoices_status_check CHECK (status IN ('OPEN','PAID','OVERDUE','CANCELED')),
  CONSTRAINT company_delivery_invoices_amount_check CHECK ("amountCents" > 0)
);
CREATE INDEX IF NOT EXISTS company_delivery_invoices_company_idx ON company_delivery_invoices("companyId", status, "dueAt");

CREATE TABLE IF NOT EXISTS delivery_partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partnerId" uuid NOT NULL REFERENCES delivery_partners(id) ON DELETE RESTRICT,
  status varchar(24) NOT NULL DEFAULT 'PENDING',
  "amountCents" bigint NOT NULL,
  "pixKeySnapshot" varchar(255) NULL,
  "providerTransferId" varchar(180) NULL,
  "periodStart" timestamptz NULL,
  "periodEnd" timestamptz NULL,
  "createdByUserId" varchar NULL,
  "paidAt" timestamptz NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_partner_payouts_status_check CHECK (status IN ('PENDING','PROCESSING','PAID','FAILED','CANCELED')),
  CONSTRAINT delivery_partner_payouts_amount_check CHECK ("amountCents" > 0)
);
CREATE INDEX IF NOT EXISTS delivery_partner_payouts_partner_idx ON delivery_partner_payouts("partnerId", status, "createdAt" DESC);

-- FASE 5: solicitação e propostas versionadas de serviços
CREATE TABLE IF NOT EXISTS classified_service_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "listingId" uuid NOT NULL REFERENCES classified_listings(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "customerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "conversationId" uuid NULL REFERENCES classified_conversations(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'REQUESTED',
  scope text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  "currentVersionNumber" integer NOT NULL DEFAULT 0,
  "acceptedVersionId" uuid NULL,
  "acceptedAt" timestamptz NULL,
  "declinedAt" timestamptz NULL,
  "canceledAt" timestamptz NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_service_quote_requests_status_check CHECK (status IN ('REQUESTED','DRAFT','SENT','NEGOTIATING','ACCEPTED','DECLINED','EXPIRED','CANCELED'))
);
CREATE INDEX IF NOT EXISTS classified_service_quote_requests_company_idx ON classified_service_quote_requests("companyId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS classified_service_quote_requests_customer_idx ON classified_service_quote_requests("customerUserId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS classified_service_quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" uuid NOT NULL REFERENCES classified_service_quote_requests(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  "amountCents" bigint NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL,
  conditions text NULL,
  "deliveryDays" integer NULL,
  "validUntil" timestamptz NOT NULL,
  "createdByUserId" varchar NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_service_quote_versions_amount_check CHECK ("amountCents" >= 0),
  CONSTRAINT classified_service_quote_versions_delivery_check CHECK ("deliveryDays" IS NULL OR "deliveryDays" >= 0),
  CONSTRAINT classified_service_quote_versions_uq UNIQUE ("requestId", version)
);
CREATE INDEX IF NOT EXISTS classified_service_quote_versions_request_idx ON classified_service_quote_versions("requestId", version DESC);

ALTER TABLE classified_service_quote_requests
  DROP CONSTRAINT IF EXISTS classified_service_quote_requests_accepted_version_fk;
ALTER TABLE classified_service_quote_requests
  ADD CONSTRAINT classified_service_quote_requests_accepted_version_fk FOREIGN KEY ("acceptedVersionId") REFERENCES classified_service_quote_versions(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS classified_service_quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" uuid NOT NULL REFERENCES classified_service_quote_requests(id) ON DELETE RESTRICT,
  action varchar(48) NOT NULL,
  "fromStatus" varchar(24) NULL,
  "toStatus" varchar(24) NULL,
  "actorUserId" varchar NULL,
  metadata jsonb NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classified_service_quote_events_request_idx ON classified_service_quote_events("requestId", "createdAt");

CREATE TABLE IF NOT EXISTS classified_service_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" uuid NOT NULL UNIQUE REFERENCES classified_service_quote_requests(id) ON DELETE RESTRICT,
  "quoteVersionId" uuid NOT NULL REFERENCES classified_service_quote_versions(id) ON DELETE RESTRICT,
  "companyId" uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  "customerUserId" varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status varchar(24) NOT NULL DEFAULT 'ACCEPTED',
  "snapshot" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_service_contracts_status_check CHECK (status IN ('ACCEPTED','IN_PROGRESS','COMPLETED','CANCELED'))
);

-- Registros financeiros e versões de proposta são imutáveis. Correções são novos eventos/lançamentos.
CREATE OR REPLACE FUNCTION prevent_commerce_immutable_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable commerce record cannot be changed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_partner_ledger_immutable ON delivery_partner_ledger_entries;
CREATE TRIGGER trg_delivery_partner_ledger_immutable BEFORE UPDATE OR DELETE ON delivery_partner_ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_commerce_immutable_mutation();

DROP TRIGGER IF EXISTS trg_company_delivery_wallet_movements_immutable ON company_delivery_wallet_movements;
CREATE TRIGGER trg_company_delivery_wallet_movements_immutable BEFORE UPDATE OR DELETE ON company_delivery_wallet_movements
FOR EACH ROW EXECUTE FUNCTION prevent_commerce_immutable_mutation();

DROP TRIGGER IF EXISTS trg_service_quote_versions_immutable ON classified_service_quote_versions;
CREATE TRIGGER trg_service_quote_versions_immutable BEFORE UPDATE OR DELETE ON classified_service_quote_versions
FOR EACH ROW EXECUTE FUNCTION prevent_commerce_immutable_mutation();
