-- A empresa pode retirar unilateralmente o aceite enquanto a oferta ainda nao foi usada em pedido/checkout.
ALTER TABLE classified_offers
  ADD COLUMN IF NOT EXISTS "revokedAt" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "revokedByUserId" varchar NULL;

ALTER TABLE classified_offers DROP CONSTRAINT IF EXISTS classified_offers_status_check;
ALTER TABLE classified_offers
  ADD CONSTRAINT classified_offers_status_check
  CHECK (status IN ('PENDING','ACCEPTED','REJECTED','EXPIRED','WITHDRAWN','REVOKED','CONSUMED'));

CREATE INDEX IF NOT EXISTS classified_offers_revoked_idx
  ON classified_offers(status,"revokedAt")
  WHERE status='REVOKED';

-- CORRECAO CRITICA DE COMPATIBILIDADE
-- Bancos que receberam a migration historica 20260825_classifieds_offers_analytics_chat.sql
-- podem ainda ter uma versao de settle_accepted_classified_offer() que muda o anuncio
-- de PUBLISHED para PAUSED ao aceitar uma oferta. Aceite de oferta nao reserva estoque,
-- nao conclui venda e nunca deve alterar a visibilidade do anuncio.
CREATE OR REPLACE FUNCTION settle_accepted_classified_offer()
RETURNS trigger AS $$
DECLARE
  conversation_id uuid;
BEGIN
  IF NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT id INTO conversation_id
    FROM classified_conversations
    WHERE "listingId" = NEW."listingId"
      AND "buyerUserId" = NEW."buyerUserId"
      AND "sellerUserId" = NEW."sellerUserId"
      AND (("buyerCompanyId" IS NULL AND NEW."buyerCompanyId" IS NULL) OR "buyerCompanyId" = NEW."buyerCompanyId")
      AND (("sellerCompanyId" IS NULL AND NEW."sellerCompanyId" IS NULL) OR "sellerCompanyId" = NEW."sellerCompanyId")
    ORDER BY "createdAt" DESC
    LIMIT 1;

    IF conversation_id IS NULL THEN
      INSERT INTO classified_conversations(
        "listingId","buyerUserId","buyerCompanyId","sellerUserId","sellerCompanyId",
        "buyerLastReadAt","sellerLastReadAt","lastMessageAt"
      ) VALUES (
        NEW."listingId",NEW."buyerUserId",NEW."buyerCompanyId",NEW."sellerUserId",NEW."sellerCompanyId",
        now(),NULL,NULL
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

-- O canal realtime avisa comprador e vendedor sempre que uma oferta nasce ou muda.
-- O payload carrega apenas identificadores/estado, nunca dados pessoais ou valores sensiveis.
CREATE OR REPLACE FUNCTION pn_notify_classified_offer_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'pira_classified_offers',
    json_build_object(
      'operation', TG_OP,
      'offerId', NEW.id,
      'listingId', NEW."listingId",
      'status', NEW.status,
      'buyerUserId', NEW."buyerUserId",
      'buyerCompanyId', NEW."buyerCompanyId",
      'sellerUserId', NEW."sellerUserId",
      'sellerCompanyId', NEW."sellerCompanyId"
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pn_notify_classified_offer_change ON classified_offers;
CREATE TRIGGER trg_pn_notify_classified_offer_change
AFTER INSERT OR UPDATE OF status, amount, "expiresAt", "orderId" ON classified_offers
FOR EACH ROW EXECUTE FUNCTION pn_notify_classified_offer_change();
