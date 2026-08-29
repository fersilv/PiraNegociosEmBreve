-- Cache de distância viária por origem/destino.
-- Independente da cotação e da tabela de preço, para reaproveitar a mesma rota em consultas futuras.

CREATE TABLE IF NOT EXISTS delivery_route_distance_cache (
  "cacheKey" varchar(64) PRIMARY KEY,
  "originZipCode" varchar(8) NULL,
  "destinationZipCode" varchar(8) NULL,
  "originLatitude" numeric(10,7) NOT NULL,
  "originLongitude" numeric(10,7) NOT NULL,
  "destinationLatitude" numeric(10,7) NOT NULL,
  "destinationLongitude" numeric(10,7) NOT NULL,
  profile varchar(24) NOT NULL DEFAULT 'driving',
  provider varchar(32) NOT NULL,
  "distanceMeters" integer NOT NULL,
  "durationSeconds" integer NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_route_distance_cache_distance_check CHECK ("distanceMeters" > 0),
  CONSTRAINT delivery_route_distance_cache_duration_check CHECK ("durationSeconds" IS NULL OR "durationSeconds" > 0),
  CONSTRAINT delivery_route_distance_cache_provider_check CHECK (provider IN ('GOOGLE_ROUTES','OSRM')),
  CONSTRAINT delivery_route_distance_cache_origin_lat_check CHECK ("originLatitude" BETWEEN -90 AND 90),
  CONSTRAINT delivery_route_distance_cache_origin_lng_check CHECK ("originLongitude" BETWEEN -180 AND 180),
  CONSTRAINT delivery_route_distance_cache_destination_lat_check CHECK ("destinationLatitude" BETWEEN -90 AND 90),
  CONSTRAINT delivery_route_distance_cache_destination_lng_check CHECK ("destinationLongitude" BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS delivery_route_distance_cache_zip_pair_idx
  ON delivery_route_distance_cache("originZipCode","destinationZipCode",profile,"expiresAt" DESC);

CREATE INDEX IF NOT EXISTS delivery_route_distance_cache_expires_idx
  ON delivery_route_distance_cache("expiresAt");
