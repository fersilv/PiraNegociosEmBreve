-- Canal leve de realtime para a central operacional de pedidos.
-- O payload contém somente IDs/status. Dados privados continuam sendo buscados
-- pela API autenticada da empresa após o evento.

CREATE OR REPLACE FUNCTION pn_notify_classified_order_realtime()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'pira_classified_orders',
    json_build_object(
      'orderId', NEW.id,
      'companyId', NEW."companyId",
      'status', NEW.status,
      'paymentStatus', NEW."paymentStatus",
      'operation', TG_OP,
      'at', now()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_notify_classified_order_realtime ON classified_orders;
CREATE TRIGGER trg_pn_notify_classified_order_realtime
AFTER INSERT OR UPDATE OF status, "paymentStatus" ON classified_orders
FOR EACH ROW EXECUTE FUNCTION pn_notify_classified_order_realtime();
