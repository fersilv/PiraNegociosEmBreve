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
