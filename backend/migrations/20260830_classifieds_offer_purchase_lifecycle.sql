-- Oferta aceita = preço temporário exclusivo do comprador, sem pausar a vitrine.
-- Também separa reserva de estoque de baixa definitiva e adiciona ordem de compra sem reserva antecipada.

ALTER TABLE company_commerce_settings
  ADD COLUMN IF NOT EXISTS "autoPauseWhenOutOfStock" boolean NOT NULL DEFAULT false;

ALTER TABLE classified_orders
  ADD COLUMN IF NOT EXISTS "offerId" uuid NULL,
  ADD COLUMN IF NOT EXISTS "orderMode" varchar(24) NOT NULL DEFAULT 'ONLINE_PAYMENT',
  ADD COLUMN IF NOT EXISTS "stockCommittedAt" timestamptz NULL;

ALTER TABLE classified_orders
  DROP CONSTRAINT IF EXISTS classified_orders_order_mode_check;
ALTER TABLE classified_orders
  ADD CONSTRAINT classified_orders_order_mode_check
  CHECK ("orderMode" IN ('ONLINE_PAYMENT','PURCHASE_ORDER'));

ALTER TABLE classified_offers
  ADD COLUMN IF NOT EXISTS "orderId" uuid NULL,
  ADD COLUMN IF NOT EXISTS "consumedAt" timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='classified_orders_offer_fk'
      AND conrelid='classified_orders'::regclass
  ) THEN
    ALTER TABLE classified_orders
      ADD CONSTRAINT classified_orders_offer_fk
      FOREIGN KEY ("offerId") REFERENCES classified_offers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='classified_offers_order_fk'
      AND conrelid='classified_offers'::regclass
  ) THEN
    ALTER TABLE classified_offers
      ADD CONSTRAINT classified_offers_order_fk
      FOREIGN KEY ("orderId") REFERENCES classified_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS classified_offers_order_uq;
CREATE UNIQUE INDEX classified_offers_order_uq
  ON classified_offers("orderId") WHERE "orderId" IS NOT NULL;

DROP INDEX IF EXISTS classified_orders_offer_uq;
CREATE UNIQUE INDEX classified_orders_offer_uq
  ON classified_orders("offerId") WHERE "offerId" IS NOT NULL;

ALTER TABLE classified_offers DROP CONSTRAINT IF EXISTS classified_offers_status_check;
ALTER TABLE classified_offers
  ADD CONSTRAINT classified_offers_status_check
  CHECK (status IN ('PENDING','ACCEPTED','REJECTED','EXPIRED','WITHDRAWN','CONSUMED'));

-- Mantém a criação da conversa automática, mas oferta aceita NÃO pausa mais o anúncio.
CREATE OR REPLACE FUNCTION settle_accepted_classified_offer()
RETURNS trigger AS $$
DECLARE
  listing_row classified_listings%ROWTYPE;
  conversation_id uuid;
BEGIN
  IF NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO listing_row FROM classified_listings WHERE id = NEW."listingId";
    IF listing_row.id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id INTO conversation_id
    FROM classified_conversations
    WHERE "listingId" = NEW."listingId"
      AND "buyerUserId" = NEW."buyerUserId"
      AND "sellerUserId" = NEW."sellerUserId"
    LIMIT 1;

    IF conversation_id IS NULL THEN
      INSERT INTO classified_conversations(
        "listingId","buyerUserId","buyerCompanyId","sellerUserId","sellerCompanyId","lastMessageAt"
      ) VALUES (
        NEW."listingId",NEW."buyerUserId",NEW."buyerCompanyId",NEW."sellerUserId",NEW."sellerCompanyId",now()
      )
      RETURNING id INTO conversation_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_settle_accepted_classified_offer ON classified_offers;
CREATE TRIGGER trg_settle_accepted_classified_offer
AFTER UPDATE OF status ON classified_offers
FOR EACH ROW EXECUTE FUNCTION settle_accepted_classified_offer();

-- Qualquer checkout online que nascer para o comprador de uma oferta aceita ativa recebe
-- automaticamente o preço negociado. A oferta não é tratada como desconto promocional:
-- Pix/cartão não acumulam desconto e discountCents fica zerado.
CREATE OR REPLACE FUNCTION pn_apply_accepted_offer_to_order()
RETURNS trigger AS $$
DECLARE
  offer_row record;
  rate_bps integer := 0;
  min_fee integer := 0;
  max_fee integer := NULL;
  offer_unit_cents integer;
  subtotal bigint;
  platform_fee bigint;
  shipping bigint := COALESCE(NEW."shippingCents",0);
  buyer_fee bigint := COALESCE(NEW."buyerFeeCents",0);
  offer_snapshot jsonb;
BEGIN
  IF NEW."orderMode" <> 'ONLINE_PAYMENT' OR NEW."offerId" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO offer_row
  FROM classified_offers
  WHERE "listingId"=NEW."listingId"
    AND "buyerUserId"=NEW."buyerUserId"
    AND status='ACCEPTED'
    AND "expiresAt">now()
    AND "orderId" IS NULL
  ORDER BY "respondedAt" DESC NULLS LAST,"updatedAt" DESC
  LIMIT 1
  FOR UPDATE;

  IF offer_row.id IS NULL THEN
    RETURN NEW;
  END IF;

  offer_unit_cents := ROUND(offer_row.amount::numeric * 100)::integer;
  IF offer_unit_cents <= 0 THEN
    RETURN NEW;
  END IF;

  rate_bps := COALESCE(NULLIF(NEW.metadata->'feeRule'->>'rateBps','')::integer, 0);
  min_fee := COALESCE(NULLIF(NEW.metadata->'feeRule'->>'minimumFeeCents','')::integer, 0);
  BEGIN
    max_fee := NULLIF(NEW.metadata->'feeRule'->>'maximumFeeCents','')::integer;
  EXCEPTION WHEN invalid_text_representation THEN
    max_fee := NULL;
  END;

  subtotal := offer_unit_cents::bigint * GREATEST(1,NEW.quantity);
  platform_fee := ROUND(subtotal::numeric * rate_bps::numeric / 10000)::bigint;
  platform_fee := GREATEST(platform_fee,min_fee);
  IF max_fee IS NOT NULL THEN
    platform_fee := LEAST(platform_fee,max_fee);
  END IF;
  platform_fee := LEAST(platform_fee,subtotal);

  offer_snapshot := jsonb_build_object(
    'id',offer_row.id,
    'amount',offer_row.amount,
    'amountCents',offer_unit_cents,
    'expiresAt',offer_row."expiresAt",
    'pricingMode','ACCEPTED_OFFER',
    'paymentDiscountsSuppressed',true
  );

  NEW."offerId" := offer_row.id;
  NEW."unitPriceCents" := offer_unit_cents;
  NEW."discountCents" := 0;
  NEW."itemSubtotalCents" := subtotal;
  NEW."platformFeeCents" := platform_fee;
  NEW."sellerNetCents" := GREATEST(0,subtotal-platform_fee);
  NEW."applicationFeeCents" := platform_fee + shipping;
  NEW."totalCents" := subtotal + shipping + buyer_fee;
  NEW.metadata := COALESCE(NEW.metadata,'{}'::jsonb)
    || jsonb_build_object('acceptedOffer',offer_snapshot,'pricingSource','ACCEPTED_OFFER');
  NEW."paymentFinancialSnapshot" := COALESCE(NEW."paymentFinancialSnapshot",'{}'::jsonb)
    || jsonb_build_object(
      'itemSubtotalCents',subtotal,
      'shippingCents',shipping,
      'buyerFeeCents',buyer_fee,
      'totalCents',NEW."totalCents",
      'platformFeeCents',platform_fee,
      'applicationFeeCents',NEW."applicationFeeCents",
      'sellerNetCents',NEW."sellerNetCents",
      'pricingSource','ACCEPTED_OFFER',
      'acceptedOffer',offer_snapshot
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_apply_accepted_offer_to_order ON classified_orders;
CREATE TRIGGER trg_pn_apply_accepted_offer_to_order
BEFORE INSERT ON classified_orders
FOR EACH ROW EXECUTE FUNCTION pn_apply_accepted_offer_to_order();

-- Vincula a oferta ao pedido depois que o pedido existe e corrige o snapshot do item
-- que os checkouts inserem logo após criar classified_orders.
CREATE OR REPLACE FUNCTION pn_claim_offer_after_order_insert()
RETURNS trigger AS $$
BEGIN
  IF NEW."offerId" IS NOT NULL THEN
    UPDATE classified_offers
    SET "orderId"=NEW.id,"updatedAt"=now()
    WHERE id=NEW."offerId" AND status='ACCEPTED' AND "orderId" IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_claim_offer_after_order_insert ON classified_orders;
CREATE TRIGGER trg_pn_claim_offer_after_order_insert
AFTER INSERT ON classified_orders
FOR EACH ROW EXECUTE FUNCTION pn_claim_offer_after_order_insert();

CREATE OR REPLACE FUNCTION pn_align_offer_order_item_price()
RETURNS trigger AS $$
DECLARE
  ord record;
BEGIN
  SELECT * INTO ord FROM classified_orders WHERE id=NEW."orderId";
  IF ord."offerId" IS NULL OR NEW."listingId"<>ord."listingId" THEN
    RETURN NEW;
  END IF;
  NEW."unitPriceCents" := ord."unitPriceCents";
  NEW."discountCents" := 0;
  NEW."totalCents" := ord."unitPriceCents"::bigint * NEW.quantity;
  NEW."listingSnapshot" := COALESCE(NEW."listingSnapshot",'{}'::jsonb)
    || jsonb_build_object('acceptedOffer',ord.metadata->'acceptedOffer','pricingSource','ACCEPTED_OFFER');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_align_offer_order_item_price ON classified_order_items;
CREATE TRIGGER trg_pn_align_offer_order_item_price
BEFORE INSERT ON classified_order_items
FOR EACH ROW EXECUTE FUNCTION pn_align_offer_order_item_price();

-- Pagamento online: a unidade já foi removida do saldo disponível como reserva.
-- Na aprovação apenas consolidamos a venda, consumimos a oferta e, se configurado,
-- pausamos a vitrine quando o estoque chegou a zero.
CREATE OR REPLACE FUNCTION pn_finalize_offer_and_inventory_from_payment()
RETURNS trigger AS $$
DECLARE
  stock_now integer;
  auto_pause boolean := false;
BEGIN
  IF NEW."paymentStatus" IS NOT DISTINCT FROM OLD."paymentStatus" THEN
    RETURN NEW;
  END IF;

  IF NEW."offerId" IS NOT NULL THEN
    IF NEW."paymentStatus"='APPROVED' THEN
      UPDATE classified_offers
      SET status='CONSUMED', "consumedAt"=COALESCE("consumedAt",now()), "orderId"=NEW.id, "updatedAt"=now()
      WHERE id=NEW."offerId" AND status IN ('ACCEPTED','CONSUMED');
    ELSIF NEW."paymentStatus" IN ('REJECTED','CANCELED') THEN
      UPDATE classified_offers
      SET status=CASE WHEN "expiresAt"<=now() THEN 'EXPIRED' ELSE 'ACCEPTED' END,
          "orderId"=NULL,
          "updatedAt"=now()
      WHERE id=NEW."offerId" AND "orderId"=NEW.id AND status='ACCEPTED';
      UPDATE classified_orders SET "offerId"=NULL WHERE id=NEW.id;
    END IF;
  END IF;

  IF NEW."paymentStatus"='APPROVED' AND NEW."orderMode"='ONLINE_PAYMENT' AND NEW."stockCommittedAt" IS NULL THEN
    UPDATE classified_orders SET "stockCommittedAt"=now() WHERE id=NEW.id;

    SELECT NULLIF(l."commerceConfig"->'onlineCheckout'->>'stockQuantity','')::integer,
           COALESCE(cs."autoPauseWhenOutOfStock",false)
      INTO stock_now, auto_pause
    FROM classified_listings l
    LEFT JOIN company_commerce_settings cs ON cs."companyId"=l."companyId"
    WHERE l.id=NEW."listingId";

    IF stock_now IS NOT NULL AND stock_now <= 0 AND auto_pause THEN
      UPDATE classified_listings
      SET status='PAUSED', "updatedAt"=now()
      WHERE id=NEW."listingId" AND status='PUBLISHED';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_finalize_offer_and_inventory_from_payment ON classified_orders;
CREATE TRIGGER trg_pn_finalize_offer_and_inventory_from_payment
AFTER UPDATE OF "paymentStatus" ON classified_orders
FOR EACH ROW EXECUTE FUNCTION pn_finalize_offer_and_inventory_from_payment();

-- Ordem de compra direta não reserva estoque. A baixa só ocorre quando a empresa conclui.
CREATE OR REPLACE FUNCTION pn_commit_purchase_order_stock()
RETURNS trigger AS $$
DECLARE
  stock_now integer;
  auto_pause boolean := false;
BEGIN
  IF NEW."orderMode" <> 'PURCHASE_ORDER'
     OR NEW.status <> 'COMPLETED'
     OR OLD.status = 'COMPLETED'
     OR NEW."stockCommittedAt" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(l."commerceConfig"->'onlineCheckout'->>'stockQuantity','')::integer,
         COALESCE(cs."autoPauseWhenOutOfStock",false)
    INTO stock_now, auto_pause
  FROM classified_listings l
  LEFT JOIN company_commerce_settings cs ON cs."companyId"=l."companyId"
  WHERE l.id=NEW."listingId"
  FOR UPDATE OF l;

  IF stock_now IS NOT NULL THEN
    IF stock_now < NEW.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para concluir esta ordem de compra.';
    END IF;

    stock_now := stock_now - NEW.quantity;
    UPDATE classified_listings
    SET "commerceConfig"=jsonb_set(
          COALESCE("commerceConfig",'{}'::jsonb),
          '{onlineCheckout,stockQuantity}',
          to_jsonb(stock_now),
          true
        ),
        status=CASE WHEN stock_now=0 AND auto_pause THEN 'PAUSED' ELSE status END,
        "updatedAt"=now()
    WHERE id=NEW."listingId";
  END IF;

  UPDATE classified_orders SET "stockCommittedAt"=now() WHERE id=NEW.id;
  UPDATE classified_order_items SET "stockReserved"=false WHERE "orderId"=NEW.id;

  IF NEW."offerId" IS NOT NULL THEN
    UPDATE classified_offers
    SET status='CONSUMED', "consumedAt"=COALESCE("consumedAt",now()), "orderId"=NEW.id, "updatedAt"=now()
    WHERE id=NEW."offerId" AND status IN ('ACCEPTED','CONSUMED');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_commit_purchase_order_stock ON classified_orders;
CREATE TRIGGER trg_pn_commit_purchase_order_stock
AFTER UPDATE OF status ON classified_orders
FOR EACH ROW EXECUTE FUNCTION pn_commit_purchase_order_stock();
