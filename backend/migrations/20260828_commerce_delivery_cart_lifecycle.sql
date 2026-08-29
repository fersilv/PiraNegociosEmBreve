-- Compatibilidade do webhook/checkout unitário com pedidos multi-item.

ALTER TABLE classified_orders DROP CONSTRAINT IF EXISTS classified_orders_fulfillment_check;
ALTER TABLE classified_orders
  ADD CONSTRAINT classified_orders_fulfillment_check
  CHECK ("fulfillmentMode" IN ('ARRANGE','PICKUP','DELIVERY','ROUND_TRIP'));

-- Quando o checkout legado libera estoque, ele restaura o listing principal usando
-- classified_orders.quantity. Em carrinhos, restauramos apenas os itens restantes
-- e a eventual diferença, evitando devolução em dobro do primeiro item.
CREATE OR REPLACE FUNCTION pn_restore_cart_items_after_stock_release()
RETURNS trigger AS $$
DECLARE
  ord record;
  item record;
  restore_qty integer;
  current_stock integer;
BEGIN
  IF NEW.type <> 'STOCK_RELEASED' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ord FROM classified_orders WHERE id=NEW."orderId";
  IF ord."cartId" IS NULL THEN
    RETURN NEW;
  END IF;

  FOR item IN
    SELECT * FROM classified_order_items
    WHERE "orderId"=ord.id AND "stockReserved"=true
    FOR UPDATE
  LOOP
    restore_qty := item.quantity;
    IF item."listingId" = ord."listingId" THEN
      restore_qty := GREATEST(0, item.quantity - GREATEST(0, ord.quantity));
    END IF;

    IF restore_qty > 0 THEN
      SELECT NULLIF("commerceConfig"->'onlineCheckout'->>'stockQuantity','')::integer
      INTO current_stock
      FROM classified_listings
      WHERE id=item."listingId"
      FOR UPDATE;

      IF current_stock IS NOT NULL THEN
        UPDATE classified_listings
        SET "commerceConfig"=jsonb_set(
              COALESCE("commerceConfig",'{}'::jsonb),
              '{onlineCheckout,stockQuantity}',
              to_jsonb(current_stock + restore_qty),
              true
            ),
            "updatedAt"=now()
        WHERE id=item."listingId";
      END IF;
    END IF;
  END LOOP;

  UPDATE classified_order_items SET "stockReserved"=false WHERE "orderId"=ord.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_restore_cart_items_after_stock_release ON classified_order_events;
CREATE TRIGGER trg_pn_restore_cart_items_after_stock_release
AFTER INSERT ON classified_order_events
FOR EACH ROW EXECUTE FUNCTION pn_restore_cart_items_after_stock_release();

CREATE OR REPLACE FUNCTION pn_finalize_cart_from_payment_status()
RETURNS trigger AS $$
DECLARE
  has_other_active boolean;
BEGIN
  IF NEW."cartId" IS NULL OR NEW."paymentStatus" IS NOT DISTINCT FROM OLD."paymentStatus" THEN
    RETURN NEW;
  END IF;

  IF NEW."paymentStatus"='APPROVED' THEN
    UPDATE classified_order_items SET "stockReserved"=false WHERE "orderId"=NEW.id;
    UPDATE classified_carts
    SET status='CONVERTED',
        metadata=(COALESCE(metadata,'{}'::jsonb)-'pendingOrderId') || jsonb_build_object('orderId',NEW.id::text),
        "updatedAt"=now()
    WHERE id=NEW."cartId";
    UPDATE delivery_quotes
    SET status='CONSUMED'
    WHERE id=(SELECT "selectedQuoteId" FROM classified_carts WHERE id=NEW."cartId")
      AND status IN ('QUOTED','SELECTED');
  ELSIF NEW."paymentStatus" IN ('REJECTED','CANCELED') THEN
    SELECT EXISTS(
      SELECT 1 FROM classified_carts
      WHERE "buyerUserId"=NEW."buyerUserId" AND status='ACTIVE' AND id<>NEW."cartId"
    ) INTO has_other_active;

    UPDATE classified_carts
    SET status=CASE WHEN has_other_active THEN 'ABANDONED' ELSE 'ACTIVE' END,
        metadata=(COALESCE(metadata,'{}'::jsonb)-'pendingOrderId') || jsonb_build_object('lastRejectedOrderId',NEW.id::text),
        "updatedAt"=now()
    WHERE id=NEW."cartId";

    UPDATE delivery_quotes
    SET status=CASE WHEN "expiresAt">now() THEN 'QUOTED' ELSE 'EXPIRED' END
    WHERE id=(SELECT "selectedQuoteId" FROM classified_carts WHERE id=NEW."cartId")
      AND status='SELECTED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_finalize_cart_from_payment_status ON classified_orders;
CREATE TRIGGER trg_pn_finalize_cart_from_payment_status
AFTER UPDATE OF "paymentStatus" ON classified_orders
FOR EACH ROW EXECUTE FUNCTION pn_finalize_cart_from_payment_status();

-- Reconciliação mínima também para alterações processadas pelo serviço legado.
CREATE OR REPLACE FUNCTION pn_audit_marketplace_payment_status()
RETURNS trigger AS $$
DECLARE
  fingerprint text;
BEGIN
  IF NEW."paymentStatus" IS NOT DISTINCT FROM OLD."paymentStatus" THEN
    RETURN NEW;
  END IF;
  IF NEW."paymentProvider" IS NULL THEN
    RETURN NEW;
  END IF;

  fingerprint := md5(
    NEW.id::text || ':' || COALESCE(NEW."providerPaymentId",'') || ':' ||
    NEW."paymentStatus" || ':' || COALESCE(NEW."providerStatusDetail",'')
  );

  INSERT INTO classified_payment_reconciliation_events(
    "orderId",provider,"providerPaymentId",source,"paymentStatus",
    "grossAmountCents","applicationFeeCents","providerFeeCents","providerNetCents",
    "statusDetail","eventFingerprint",metadata
  ) VALUES (
    NEW.id,NEW."paymentProvider",NEW."providerPaymentId",'RECONCILIATION',NEW."paymentStatus",
    NEW."totalCents",COALESCE(NEW."applicationFeeCents",NEW."platformFeeCents"),
    NEW."providerFeeCents",NEW."providerNetCents",NEW."providerStatusDetail",fingerprint,
    jsonb_build_object('source','database_payment_status_trigger')
  ) ON CONFLICT ("eventFingerprint") DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_audit_marketplace_payment_status ON classified_orders;
CREATE TRIGGER trg_pn_audit_marketplace_payment_status
AFTER UPDATE OF "paymentStatus" ON classified_orders
FOR EACH ROW EXECUTE FUNCTION pn_audit_marketplace_payment_status();
