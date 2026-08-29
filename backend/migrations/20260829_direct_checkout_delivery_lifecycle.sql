-- Lifecycle da cotação usada pelo checkout unitário com entrega parceira.
-- Carrinhos possuem lifecycle próprio; esta função cobre pedidos diretos (cartId IS NULL).

CREATE OR REPLACE FUNCTION pn_finalize_direct_delivery_quote_from_payment_status()
RETURNS trigger AS $$
DECLARE
  quote_id uuid;
BEGIN
  IF NEW."cartId" IS NOT NULL OR NEW."paymentStatus" IS NOT DISTINCT FROM OLD."paymentStatus" THEN
    RETURN NEW;
  END IF;

  BEGIN
    quote_id := NULLIF(NEW."deliveryQuoteSnapshot"->>'id','')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    quote_id := NULL;
  END;

  IF quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."paymentStatus"='APPROVED' THEN
    UPDATE delivery_quotes
    SET status='CONSUMED'
    WHERE id=quote_id AND status IN ('QUOTED','SELECTED');

    UPDATE classified_order_items
    SET "stockReserved"=false
    WHERE "orderId"=NEW.id AND "stockReserved"=true;
  ELSIF NEW."paymentStatus" IN ('REJECTED','CANCELED') THEN
    UPDATE delivery_quotes
    SET status=CASE WHEN "expiresAt">now() THEN 'QUOTED' ELSE 'EXPIRED' END
    WHERE id=quote_id AND status='SELECTED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_finalize_direct_delivery_quote_from_payment_status ON classified_orders;
CREATE TRIGGER trg_pn_finalize_direct_delivery_quote_from_payment_status
AFTER UPDATE OF "paymentStatus" ON classified_orders
FOR EACH ROW EXECUTE FUNCTION pn_finalize_direct_delivery_quote_from_payment_status();
