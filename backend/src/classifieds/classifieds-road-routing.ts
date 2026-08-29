import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

export type DeliveryRoutePoint = {
  latitude: number;
  longitude: number;
  zipCode?: string | null;
};

export type DeliveryRouteDistance = {
  distanceMeters: number;
  durationSeconds: number | null;
  source: 'GOOGLE_ROUTES' | 'OSRM';
  cacheHit: boolean;
};

const CACHE_TTL_DAYS = 30;
const DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org';

export async function resolveRoadDistance(
  dataSource: DataSource,
  origin: DeliveryRoutePoint,
  destination: DeliveryRoutePoint,
): Promise<DeliveryRouteDistance | null> {
  const cacheKey = routeCacheKey(origin, destination);
  const cached = await dataSource.query(
    `SELECT "distanceMeters","durationSeconds",provider
     FROM delivery_route_distance_cache
     WHERE "cacheKey"=$1 AND "expiresAt">now()
     LIMIT 1`,
    [cacheKey],
  ).catch(() => []);

  if (cached[0]) {
    return {
      distanceMeters: Number(cached[0].distanceMeters),
      durationSeconds: cached[0].durationSeconds == null ? null : Number(cached[0].durationSeconds),
      source: cached[0].provider === 'GOOGLE_ROUTES' ? 'GOOGLE_ROUTES' : 'OSRM',
      cacheHit: true,
    };
  }

  const google = await googleRoutes(origin, destination).catch(() => null);
  const routed = google || await osrmRoute(origin, destination).catch(() => null);
  if (!routed) return null;

  await dataSource.query(
    `INSERT INTO delivery_route_distance_cache(
       "cacheKey","originZipCode","destinationZipCode",
       "originLatitude","originLongitude","destinationLatitude","destinationLongitude",
       profile,provider,"distanceMeters","durationSeconds","expiresAt",metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'driving',$8,$9,$10,now()+($11 || ' days')::interval,$12::jsonb)
     ON CONFLICT ("cacheKey") DO UPDATE SET
       provider=EXCLUDED.provider,
       "distanceMeters"=EXCLUDED."distanceMeters",
       "durationSeconds"=EXCLUDED."durationSeconds",
       "expiresAt"=EXCLUDED."expiresAt",
       metadata=EXCLUDED.metadata,
       "updatedAt"=now()`,
    [
      cacheKey,
      digits(origin.zipCode),
      digits(destination.zipCode),
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
      routed.source,
      routed.distanceMeters,
      routed.durationSeconds,
      CACHE_TTL_DAYS,
      JSON.stringify({ profile: 'driving' }),
    ],
  ).catch(() => undefined);

  return { ...routed, cacheHit: false };
}

async function googleRoutes(origin: DeliveryRoutePoint, destination: DeliveryRoutePoint) {
  const apiKey = String(process.env.GOOGLE_ROUTES_API_KEY || '').trim();
  if (!apiKey) return null;

  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
      destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC',
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const data: any = await response.json();
  const route = Array.isArray(data?.routes) ? data.routes[0] : null;
  const distanceMeters = positiveInt(route?.distanceMeters);
  if (distanceMeters == null) return null;
  return {
    distanceMeters,
    durationSeconds: durationToSeconds(route?.duration),
    source: 'GOOGLE_ROUTES' as const,
  };
}

async function osrmRoute(origin: DeliveryRoutePoint, destination: DeliveryRoutePoint) {
  const baseUrl = String(process.env.OSRM_ROUTER_BASE_URL || DEFAULT_OSRM_BASE_URL).trim().replace(/\/$/, '');
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const response = await fetch(`${baseUrl}/route/v1/driving/${coordinates}?overview=false&alternatives=false&steps=false`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const data: any = await response.json();
  if (data?.code !== 'Ok') return null;
  const route = Array.isArray(data?.routes) ? data.routes[0] : null;
  const distanceMeters = positiveInt(route?.distance);
  if (distanceMeters == null) return null;
  return {
    distanceMeters,
    durationSeconds: positiveInt(route?.duration),
    source: 'OSRM' as const,
  };
}

function routeCacheKey(origin: DeliveryRoutePoint, destination: DeliveryRoutePoint) {
  const value = [
    'driving',
    digits(origin.zipCode) || '',
    digits(destination.zipCode) || '',
    rounded(origin.latitude),
    rounded(origin.longitude),
    rounded(destination.latitude),
    rounded(destination.longitude),
  ].join('|');
  return createHash('sha256').update(value).digest('hex');
}

function rounded(value: number) {
  return Number(value).toFixed(5);
}

function digits(value: unknown) {
  const clean = String(value || '').replace(/\D/g, '').slice(0, 8);
  return clean || null;
}

function positiveInt(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.ceil(number) : null;
}

function durationToSeconds(value: unknown) {
  const text = String(value || '').trim();
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  return match ? Math.ceil(Number(match[1])) : null;
}
