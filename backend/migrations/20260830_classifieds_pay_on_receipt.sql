-- Pagamento na entrega / retirada para vendas diretas dos Classificados.
-- A configuração global fica nas preferências de recebimento; anúncios podem sobrescrever via commerceConfig JSON.
-- Esta migration é tolerante a ambientes que ainda não aplicaram o lifecycle de ofertas.

ALTER TABLE company_classified_receipt_preferences
  ADD COLUMN IF NOT EXISTS "payOnReceiptEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payOnPickupEnabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "payOnDeliveryEnabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "receiptCashEnabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "receiptPixEnabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "receiptCreditCardEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "receiptDebitCardEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "receiptChangeEnabled" boolean NOT NULL DEFAULT true;

-- orderMode nasceu no lifecycle de ofertas. Mantemos a criação aqui também para que
-- uma instalação parcialmente migrada consiga reaplicar esta migration com segurança.
ALTER TABLE classified_orders
  ADD COLUMN IF NOT EXISTS "orderMode" varchar(24) NOT NULL DEFAULT 'ONLINE_PAYMENT';

ALTER TABLE classified_orders
  DROP CONSTRAINT IF EXISTS classified_orders_order_mode_check;
ALTER TABLE classified_orders
  ADD CONSTRAINT classified_orders_order_mode_check
  CHECK ("orderMode" IN ('ONLINE_PAYMENT','PURCHASE_ORDER','PAY_ON_RECEIPT'));

-- O fluxo atual permite retirar o aceite de uma oferta ainda não consumida. O lifecycle
-- de ofertas de instalações anteriores pode ter recriado este check sem REVOKED.
ALTER TABLE classified_offers
  DROP CONSTRAINT IF EXISTS classified_offers_status_check;
ALTER TABLE classified_offers
  ADD CONSTRAINT classified_offers_status_check
  CHECK (status IN ('PENDING','ACCEPTED','REJECTED','EXPIRED','WITHDRAWN','REVOKED','CONSUMED'));

-- Instalações anteriores podem ter apenas MERCADO_PAGO/EFI/DIRECT no check.
-- Pagamento presencial continua classificado como DIRECT, sem fingir que houve transação online.
ALTER TABLE classified_orders
  DROP CONSTRAINT IF EXISTS classified_orders_provider_check;
ALTER TABLE classified_orders
  ADD CONSTRAINT classified_orders_provider_check
  CHECK ("paymentProvider" IS NULL OR "paymentProvider" IN ('MERCADO_PAGO','EFI','DIRECT'));

CREATE INDEX IF NOT EXISTS classified_orders_pay_on_receipt_open_idx
  ON classified_orders("companyId","createdAt" DESC)
  WHERE "orderMode"='PAY_ON_RECEIPT' AND status NOT IN ('COMPLETED','CANCELED');
