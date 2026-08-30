-- Cache de geocodificação Google para rotas de entrega.
-- Mantém Place IDs e coordenadas resolvidas separados das cotações para economizar chamadas da API.

CREATE TABLE IF NOT EXISTS delivery_google_geocode_cache (
  "cacheKey" varchar(64) PRIMARY KEY,
  "placeId" varchar(255) NOT NULL,
  "formattedAddress" varchar(500) NULL,
  granularity varchar(40) NULL,
  latitude numeric(10,7) NULL,
  longitude numeric(10,7) NULL,
  types jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_google_geocode_cache_lat_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT delivery_google_geocode_cache_lng_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS delivery_google_geocode_cache_expires_idx
  ON delivery_google_geocode_cache("expiresAt");
