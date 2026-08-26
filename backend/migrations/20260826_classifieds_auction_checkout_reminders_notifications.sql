-- Leilões: duração mínima de 60 min, agendamento real, pagamento online pós-arremate,
-- taxa própria de leilão, lembretes e preferências de contato/notificação.

ALTER TABLE classified_auctions DROP CONSTRAINT IF EXISTS classified_auctions_status_check;
ALTER TABLE classified_auctions
  ADD CONSTRAINT classified_auctions_status_check
  CHECK (status IN ('SCHEDULED','OPEN','ENDED','CANCELED'));

DROP INDEX IF EXISTS classified_auctions_one_active_per_listing;
CREATE UNIQUE INDEX IF NOT EXISTS classified_auctions_one_active_per_listing
  ON classified_auctions("listingId") WHERE status IN ('SCHEDULED','OPEN');

ALTER TABLE classified_auctions DROP CONSTRAINT IF EXISTS classified_auctions_period_check;
ALTER TABLE classified_auctions
  ADD CONSTRAINT classified_auctions_period_check
  CHECK ("endsAt" >= "startsAt" + interval '60 minutes');

ALTER TABLE classified_auctions
  ADD COLUMN IF NOT EXISTS "onlinePaymentEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fulfillmentModes" jsonb NOT NULL DEFAULT '["ARRANGE"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "deliveryFeeCents" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryNote" text NULL,
  ADD COLUMN IF NOT EXISTS "settlementPaymentStatus" varchar(24) NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "settlementOrderId" uuid NULL REFERENCES classified_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "paymentConfiguredAt" timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classified_auctions_delivery_fee_check') THEN
    ALTER TABLE classified_auctions
      ADD CONSTRAINT classified_auctions_delivery_fee_check CHECK ("deliveryFeeCents" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classified_auctions_settlement_payment_check') THEN
    ALTER TABLE classified_auctions
      ADD CONSTRAINT classified_auctions_settlement_payment_check
      CHECK ("settlementPaymentStatus" IN ('NOT_STARTED','PENDING','APPROVED','REJECTED','CANCELED','REFUNDED','IN_PROCESS'));
  END IF;
END $$;

-- A comissão de leilão é independente da comissão de venda normal.
CREATE TABLE IF NOT EXISTS classified_auction_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope varchar(16) NOT NULL,
  plan varchar(16) NULL,
  "companyId" uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  "rateBps" integer NOT NULL DEFAULT 99,
  "minimumFeeCents" integer NOT NULL DEFAULT 0,
  "maximumFeeCents" integer NULL,
  enabled boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_auction_fee_rules_scope_check CHECK (scope IN ('PLAN','COMPANY')),
  CONSTRAINT classified_auction_fee_rules_plan_check CHECK (plan IS NULL OR plan IN ('FREE','PLUS','ELITE')),
  CONSTRAINT classified_auction_fee_rules_rate_check CHECK ("rateBps" BETWEEN 0 AND 10000),
  CONSTRAINT classified_auction_fee_rules_min_check CHECK ("minimumFeeCents" >= 0),
  CONSTRAINT classified_auction_fee_rules_max_check CHECK ("maximumFeeCents" IS NULL OR "maximumFeeCents" >= "minimumFeeCents"),
  CONSTRAINT classified_auction_fee_rules_shape_check CHECK (
    (scope='PLAN' AND plan IS NOT NULL AND "companyId" IS NULL)
    OR (scope='COMPANY' AND "companyId" IS NOT NULL AND plan IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS classified_auction_fee_rules_plan_uq
  ON classified_auction_fee_rules(plan) WHERE scope='PLAN';
CREATE UNIQUE INDEX IF NOT EXISTS classified_auction_fee_rules_company_uq
  ON classified_auction_fee_rules("companyId") WHERE scope='COMPANY';

INSERT INTO classified_auction_fee_rules(scope,plan,"rateBps","minimumFeeCents",enabled)
VALUES ('PLAN','FREE',99,0,true),('PLAN','PLUS',99,0,true),('PLAN','ELITE',99,0,true)
ON CONFLICT DO NOTHING;

-- Pedido de arremate usa a mesma infraestrutura de pagamento e webhook do marketplace.
ALTER TABLE classified_orders
  ADD COLUMN IF NOT EXISTS "auctionId" uuid NULL REFERENCES classified_auctions(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS classified_orders_auction_uq
  ON classified_orders("auctionId") WHERE "auctionId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS classified_auction_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "auctionId" uuid NOT NULL REFERENCES classified_auctions(id) ON DELETE CASCADE,
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "preStartSentAt" timestamptz NULL,
  "startSentAt" timestamptz NULL,
  "missYouSentAt" timestamptz NULL,
  "lastPresenceAt" timestamptz NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_auction_reminders_unique UNIQUE ("auctionId","userId")
);
CREATE INDEX IF NOT EXISTS classified_auction_reminders_due_idx
  ON classified_auction_reminders("auctionId",enabled,"preStartSentAt","startSentAt","missYouSentAt");

CREATE TABLE IF NOT EXISTS classified_auction_closure_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "auctionId" uuid NOT NULL REFERENCES classified_auctions(id) ON DELETE CASCADE,
  "userId" varchar NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(32) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classified_auction_closure_notifications_kind_check
    CHECK (kind IN ('WINNER','PARTICIPANT','PARTICIPANTS_COMPLETE'))
);
CREATE UNIQUE INDEX IF NOT EXISTS classified_auction_closure_notifications_user_uq
  ON classified_auction_closure_notifications("auctionId","userId",kind)
  WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS classified_auction_closure_notifications_complete_uq
  ON classified_auction_closure_notifications("auctionId",kind)
  WHERE "userId" IS NULL AND kind='PARTICIPANTS_COMPLETE';

-- Preferências globais de contato. A janela vale para notificações não críticas.
-- Eventos são agrupados por chave enquanto aguardam a próxima janela, evitando rajada de spam.
CREATE TABLE IF NOT EXISTS notification_delivery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category varchar(64) NOT NULL,
  title varchar(160) NOT NULL,
  message text NOT NULL,
  link text NULL,
  channels jsonb NOT NULL DEFAULT '["PUSH"]'::jsonb,
  "dedupeKey" varchar(220) NULL,
  "notBefore" timestamptz NOT NULL DEFAULT now(),
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  "lastError" text NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "sentAt" timestamptz NULL,
  CONSTRAINT notification_delivery_queue_status_check CHECK (status IN ('PENDING','PROCESSING','SENT','PARTIAL','FAILED','CANCELED'))
);
CREATE INDEX IF NOT EXISTS notification_delivery_queue_due_idx
  ON notification_delivery_queue(status,"notBefore","createdAt") WHERE status='PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS notification_delivery_queue_dedupe_uq
  ON notification_delivery_queue("userId","dedupeKey")
  WHERE "dedupeKey" IS NOT NULL AND status IN ('PENDING','PROCESSING');

COMMENT ON TABLE classified_auction_fee_rules IS 'Commission rules for auction settlement. Independent from normal marketplace sales fee rules; defaults to 0.99%.';
COMMENT ON TABLE classified_auction_reminders IS 'Opt-in reminders: 10 minutes before, at start, and one miss-you reminder after 10 minutes if the user has not opened the auction.';
COMMENT ON TABLE notification_delivery_queue IS 'Deferred multi-channel notifications honoring preferred contact windows and deduplication.';
