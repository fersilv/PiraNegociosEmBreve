-- PDV Inteligente: identidade de variação no carrinho e no pedido.
ALTER TABLE classified_cart_items
  ADD COLUMN IF NOT EXISTS "variantId" varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "variantSnapshot" jsonb;

ALTER TABLE classified_cart_items DROP CONSTRAINT IF EXISTS classified_cart_items_uq;
DROP INDEX IF EXISTS classified_cart_items_uq;
CREATE UNIQUE INDEX IF NOT EXISTS classified_cart_items_variant_uq
  ON classified_cart_items("cartId","listingId","variantId");

ALTER TABLE classified_order_items
  ADD COLUMN IF NOT EXISTS "variantId" varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "variantSnapshot" jsonb;

ALTER TABLE classified_order_items DROP CONSTRAINT IF EXISTS classified_order_items_uq;
DROP INDEX IF EXISTS classified_order_items_uq;
CREATE UNIQUE INDEX IF NOT EXISTS classified_order_items_variant_uq
  ON classified_order_items("orderId","listingId","variantId");

CREATE INDEX IF NOT EXISTS classified_cart_items_variant_idx
  ON classified_cart_items("variantId") WHERE "variantId"<>'';
CREATE INDEX IF NOT EXISTS classified_order_items_variant_idx
  ON classified_order_items("variantId") WHERE "variantId"<>'';
