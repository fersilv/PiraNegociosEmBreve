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
