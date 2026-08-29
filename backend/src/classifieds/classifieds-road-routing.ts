import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

export type DeliveryRoutePoint = {
  latitude: number;
  longitude: number;
  zipCode?: string | null;
  address?: string | null;
};

export type DeliveryRouteDistance = {
  distanceMeters: number;
  durationSeconds: number | null;
  source: 'GOOGLE_ROUTES' | 'OSRM';
  cacheHit: boolean;
};

const DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org';
const GOOGLE_ROUTING_PREFERENCE = 'TRAFFIC_AWARE_OPTIMAL';

export async function resolveRoadDistance(
  dataSource: DataSource,
  origin: DeliveryRoutePoint,
  destination: DeliveryRoutePoint,
): Promise<DeliveryRouteDistance | null> {
  const googleApiKey = String(process.env.GOOGLE_ROUTES_API_KEY || '').trim();
  const preferredProvider = googleApiKey ? 'GOOGLE_ROUTES' : 'OSRM';
  const cacheKey = routeCacheKey(origin, destination, preferredProvider);
  const cached = await dataSource.query(
    `SELECT "distanceMeters","durationSeconds",provider
     FROM delivery_route_distance_cache
     WHERE "cacheKey"=$1 AND "expiresAt">now() AND provider=$2
     LIMIT 1`,
    [cacheKey, preferredProvider],
  ).catch(() => []);

  if (cached[0]) {
    return {
      distanceMeters: Number(cached[0].distanceMeters),
      durationSeconds: cached[0].durationSeconds == null ? null : Number(cached[0].durationSeconds),
      source: cached[0].provider === 'GOOGLE_ROUTES' ? 'GOOGLE_ROUTES' : 'OSRM',
      cacheHit: true,
    };
  }

  const routed = googleApiKey
    ? await googleRoutes(origin, destination, googleApiKey).catch((error) => {
        console.warn('[delivery-routing] Google Routes failed; OSRM fallback disabled because GOOGLE_ROUTES_API_KEY is configured.', safeError(error));
        return null;
      })
    : await osrmRoute(origin, destination).catch(() => null);

  if (!routed) return null;

  await dataSource.query(
    `INSERT INTO delivery_route_distance_cache(
       "cacheKey","originZipCode","destinationZipCode",
       "originLatitude","originLongitude","destinationLatitude","destinationLongitude",
       profile,provider,"distanceMeters","durationSeconds","expiresAt",metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'driving',$8,$9,$10,now()+interval '30 days',$11::jsonb)
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
      JSON.stringify({
        profile: 'driving',
        routingPreference: routed.source === 'GOOGLE_ROUTES' ? GOOGLE_ROUTING_PREFERENCE : null,
        waypointMode: origin.address || destination.address ? 'ADDRESS_STRING' : 'LAT_LNG',
      }),
    ],
  ).catch(() => undefined);

  return { ...routed, cacheHit: false };
}

async function googleRoutes(origin: DeliveryRoutePoint, destination: DeliveryRoutePoint, apiKey: string) {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: googleWaypoint(origin),
      destination: googleWaypoint(destination),
      travelMode: 'DRIVE',
      routingPreference: GOOGLE_ROUTING_PREFERENCE,
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      units: 'METRIC',
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Google Routes HTTP ${response.status}${details ? `: ${details.slice(0, 500)}` : ''}`);
  }

  const data: any = await response.json();
  const route = Array.isArray(data?.routes) ? data.routes[0] : null;
  const distanceMeters = positiveInt(route?.distanceMeters);
  if (distanceMeters == null) throw new Error('Google Routes returned no usable route distance.');
  return {
    distanceMeters,
    durationSeconds: durationToSeconds(route?.duration),
    source: 'GOOGLE_ROUTES' as const,
  };
}

function googleWaypoint(point: DeliveryRoutePoint) {
  const address = String(point.address || '').trim();
  if (address) return { address };
  return { location: { latLng: { latitude: point.latitude, longitude: point.longitude } } };
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

function routeCacheKey(origin: DeliveryRoutePoint, destination: DeliveryRoutePoint, provider: string) {
  const value = [
    'delivery-route-v2',
    provider,
    provider === 'GOOGLE_ROUTES' ? GOOGLE_ROUTING_PREFERENCE : 'OSRM_FASTEST',
    digits(origin.zipCode) || '',
    digits(destination.zipCode) || '',
    normalizeAddress(origin.address),
    normalizeAddress(destination.address),
    rounded(origin.latitude),
    rounded(origin.longitude),
    rounded(destination.latitude),
    rounded(destination.longitude),
  ].join('|');
  return createHash('sha256').update(value).digest('hex');
}

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').slice(0, 500);
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

function safeError(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}
