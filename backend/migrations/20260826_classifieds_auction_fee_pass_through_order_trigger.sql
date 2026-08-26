-- Ajusta o pedido de arremate antes da inserção quando a taxa do leilão
-- foi explicitamente repassada ao comprador. O frete continua fora da base
-- da comissão e o vendedor preserva o valor do arremate + eventual entrega.

CREATE OR REPLACE FUNCTION apply_classified_auction_fee_pass_through()
RETURNS trigger AS $$
DECLARE
  fee_payer varchar(16);
BEGIN
  IF NEW."auctionId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "auctionFeePayer" INTO fee_payer
  FROM classified_auctions
  WHERE id = NEW."auctionId";

  IF fee_payer = 'BUYER' AND COALESCE(NEW."platformFeeCents", 0) > 0 THEN
    NEW."totalCents" := NEW."totalCents" + NEW."platformFeeCents";
    NEW."sellerNetCents" := NEW."totalCents" - NEW."platformFeeCents";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classified_auction_fee_pass_through ON classified_orders;
CREATE TRIGGER trg_classified_auction_fee_pass_through
BEFORE INSERT ON classified_orders
FOR EACH ROW EXECUTE FUNCTION apply_classified_auction_fee_pass_through();

COMMENT ON FUNCTION apply_classified_auction_fee_pass_through IS 'For auction orders with BUYER fee payer, adds the PiraNegocios auction fee to buyer total without charging commission over delivery.';
