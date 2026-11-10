-- Estrutura ADITIVA: não altera anúncios, pagamentos nem reservas atuais.
CREATE SCHEMA IF NOT EXISTS marketplace;
CREATE TABLE IF NOT EXISTS marketplace.modules (
  code text PRIMARY KEY, label text NOT NULL, enabled boolean NOT NULL DEFAULT false,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO marketplace.modules(code,label,enabled,capabilities) VALUES
 ('general','Classificados gerais',true,'{"filters":["q","city","state","minPrice","maxPrice"]}'),
 ('rentals','Locações Splash',true,'{"filters":["q","city","state","minPrice","maxPrice","guests","checkIn","checkOut","amenities","category"]}'),
 ('vehicles','Veículos',false,'{"filters":["brand","model","year","mileage","fuel"]}'),
 ('real_estate','Imóveis',false,'{"filters":["purpose","area","bedrooms","parking"]}'),
 ('services','Serviços',false,'{"filters":["specialty","city","availability"]}'),
 ('restaurants','Restaurantes',false,'{"filters":["cuisine","delivery","openNow"]}')
 ON CONFLICT(code) DO NOTHING;
CREATE TABLE IF NOT EXISTS marketplace.channels (
 code text PRIMARY KEY, label text NOT NULL, public_visible boolean NOT NULL DEFAULT true,
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO marketplace.channels(code,label,enabled) VALUES
 ('piranegocios','PiraNegócios',true),('splash','Splash',true),
 ('rapi10','Rapi10',false),('vehicles','Veículos',false),('real_estate','Imóveis',false),
 ('services','Serviços',false),('restaurants','Restaurantes',false)
 ON CONFLICT(code) DO NOTHING;
CREATE TABLE IF NOT EXISTS marketplace.listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 module_code text NOT NULL REFERENCES marketplace.modules(code),
 origin text NOT NULL, origin_id text NOT NULL,
 title text NOT NULL, description text NOT NULL DEFAULT '',
 city text NOT NULL DEFAULT '', state varchar(2) NOT NULL DEFAULT '',
 price_cents bigint, currency char(3) NOT NULL DEFAULT 'BRL',
 category text, capacity int, media jsonb NOT NULL DEFAULT '[]'::jsonb,
 public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','PAUSED','ARCHIVED')),
 destination_url text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(origin,origin_id), CHECK(price_cents IS NULL OR price_cents>=0)
);
CREATE TABLE IF NOT EXISTS marketplace.listing_channels (
 listing_id uuid NOT NULL REFERENCES marketplace.listings(id) ON DELETE CASCADE,
 channel_code text NOT NULL REFERENCES marketplace.channels(code),
 enabled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(listing_id,channel_code)
);
CREATE INDEX IF NOT EXISTS marketplace_listings_public_idx ON marketplace.listings(module_code,status,created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_listings_location_idx ON marketplace.listings(state,city);
CREATE INDEX IF NOT EXISTS marketplace_listing_channels_public_idx ON marketplace.listing_channels(channel_code,listing_id) WHERE enabled=true;
CREATE TABLE IF NOT EXISTS marketplace.rental_projection (
 listing_id uuid PRIMARY KEY REFERENCES marketplace.listings(id) ON DELETE CASCADE,
 rental_property_id uuid NOT NULL UNIQUE,
 bedrooms int, bathrooms int, amenities text[] NOT NULL DEFAULT '{}',
 instant_booking boolean NOT NULL DEFAULT false,
 -- A fonte autoritativa de calendário e reservas continua sendo a Splash.
 availability_owner text NOT NULL DEFAULT 'splash' CHECK(availability_owner='splash')
);
COMMENT ON SCHEMA marketplace IS 'Catálogo multicanal público; operações e assinaturas permanecem nos sistemas de domínio';
