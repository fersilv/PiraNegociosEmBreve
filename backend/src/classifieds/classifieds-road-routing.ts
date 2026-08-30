import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

export type DeliveryRoutePoint = {
  latitude?: number | null;
  longitude?: number | null;
  zipCode?: string | null;
  address?: string | null;
  placeId?: string | null;
  hasNumber?: boolean;
};

export type GoogleResolvedWaypoint = {
  placeId: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  granularity: string | null;
  types: string[];
  geocodeCacheHit: boolean;
};

export type DeliveryRouteDistance = {
  distanceMeters: number;
  durationSeconds: number | null;
  source: 'GOOGLE_ROUTES' | 'OSRM';
  cacheHit: boolean;
  originResolved: GoogleResolvedWaypoint | null;
  destinationResolved: GoogleResolvedWaypoint | null;
};

const DEFAULT_OSRM_BASE_URL = 'https://router.project-osrm.org';
const GOOGLE_ROUTING_PREFERENCE = 'TRAFFIC_AWARE_OPTIMAL';
const GOOGLE_GEOCODE_TTL_DAYS = 30;

export async function resolveRoadDistance(
  dataSource: DataSource,
  origin: DeliveryRoutePoint,
  destination: DeliveryRoutePoint,
): Promise<DeliveryRouteDistance | null> {
  const googleApiKey = String(process.env.GOOGLE_ROUTES_API_KEY || '').trim();

  if (googleApiKey) {
    try {
      const [originResolved, destinationResolved] = await Promise.all([
        resolveGoogleWaypoint(dataSource, origin, googleApiKey),
        resolveGoogleWaypoint(dataSource, destination, googleApiKey),
      ]);
      const cacheKey = googleRouteCacheKey(originResolved, destinationResolved);
      const cached = await dataSource.query(
        `SELECT "distanceMeters","durationSeconds"
         FROM delivery_route_distance_cache
         WHERE "cacheKey"=$1 AND "expiresAt">now() AND provider='GOOGLE_ROUTES'
         LIMIT 1`,
        [cacheKey],
      ).catch(() => []);

      if (cached[0]) {
        return {
          distanceMeters: Number(cached[0].distanceMeters),
          durationSeconds: cached[0].durationSeconds == null ? null : Number(cached[0].durationSeconds),
          source: 'GOOGLE_ROUTES',
          cacheHit: true,
          originResolved,
          destinationResolved,
        };
      }

      const routed = await googleRoutes(originResolved.placeId, destinationResolved.placeId, googleApiKey);
      await persistRouteCache(dataSource, cacheKey, origin, destination, routed, originResolved, destinationResolved);
      return {
        ...routed,
        cacheHit: false,
        originResolved,
        destinationResolved,
      };
    } catch (error) {
      console.warn(
        '[delivery-routing] Google routing failed; OSRM fallback disabled because GOOGLE_ROUTES_API_KEY is configured.',
        safeError(error),
      );
      return null;
    }
  }

  const routed = await osrmRoute(origin, destination).catch(() => null);
  if (!routed) return null;
  const cacheKey = osrmRouteCacheKey(origin, destination);
  const cached = await dataSource.query(
    `SELECT "distanceMeters","durationSeconds"
     FROM delivery_route_distance_cache
     WHERE "cacheKey"=$1 AND "expiresAt">now() AND provider='OSRM'
     LIMIT 1`,
    [cacheKey],
  ).catch(() => []);
  if (cached[0]) {
    return {
      distanceMeters: Number(cached[0].distanceMeters),
      durationSeconds: cached[0].durationSeconds == null ? null : Number(cached[0].durationSeconds),
      source: 'OSRM',
      cacheHit: true,
      originResolved: null,
      destinationResolved: null,
    };
  }
  await persistRouteCache(dataSource, cacheKey, origin, destination, routed, null, null);
  return {
    ...routed,
    cacheHit: false,
    originResolved: null,
    destinationResolved: null,
  };
}

async function resolveGoogleWaypoint(
  dataSource: DataSource,
  point: DeliveryRoutePoint,
  apiKey: string,
): Promise<GoogleResolvedWaypoint> {
  const address = String(point.address || '').trim();
  if (address) {
    const resolved = await geocodeAddress(dataSource, address, point.zipCode, apiKey);
    if (point.hasNumber && !isPreciseGranularity(resolved.granularity)) {
      throw new Error(
        `Google Geocoding resolved numbered address only as ${resolved.granularity || 'UNKNOWN'}: ${resolved.formattedAddress || address}`,
      );
    }
    return resolved;
  }

  const placeId = String(point.placeId || '').trim();
  if (placeId) {
    return {
      placeId,
      formattedAddress: null,
      latitude: finiteCoordinate(point.latitude),
      longitude: finiteCoordinate(point.longitude),
      granularity: null,
      types: [],
      geocodeCacheHit: true,
    };
  }

  throw new Error('Google routing requires a complete address or Place ID.');
}

async function geocodeAddress(
  dataSource: DataSource,
  address: string,
  zipCode: unknown,
  apiKey: string,
): Promise<GoogleResolvedWaypoint> {
  const normalized = normalizeAddress(address);
  const cacheKey = createHash('sha256').update(`google-geocode-v1|${normalized}`).digest('hex');
  const cached = await dataSource.query(
    `SELECT "placeId","formattedAddress",granularity,latitude,longitude,types
     FROM delivery_google_geocode_cache
     WHERE "cacheKey"=$1 AND "expiresAt">now()
     LIMIT 1`,
    [cacheKey],
  ).catch(() => []);

  if (cached[0]) {
    const resolved = rowToResolvedWaypoint(cached[0], true);
    validateResolvedCep(resolved.formattedAddress, zipCode);
    return resolved;
  }

  const url = `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address)}?regionCode=br&languageCode=pt-BR`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'results.placeId,results.location,results.granularity,results.formattedAddress,results.types',
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Google Geocoding HTTP ${response.status}${details ? `: ${details.slice(0, 500)}` : ''}`);
  }

  const body: any = await response.json();
  const result = Array.isArray(body?.results) ? body.results[0] : null;
  const placeId = String(result?.placeId || '').trim();
  if (!placeId) throw new Error(`Google Geocoding returned no Place ID for: ${address}`);

  const resolved: GoogleResolvedWaypoint = {
    placeId,
    formattedAddress: String(result?.formattedAddress || '').trim() || null,
    latitude: finiteCoordinate(result?.location?.latitude),
    longitude: finiteCoordinate(result?.location?.longitude),
    granularity: String(result?.granularity || '').trim().toUpperCase() || null,
    types: Array.isArray(result?.types) ? result.types.map((item: unknown) => String(item)).filter(Boolean).slice(0, 20) : [],
    geocodeCacheHit: false,
  };
  validateResolvedCep(resolved.formattedAddress, zipCode);

  await dataSource.query(
    `INSERT INTO delivery_google_geocode_cache(
       "cacheKey","placeId","formattedAddress",granularity,latitude,longitude,types,"expiresAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now()+interval '${GOOGLE_GEOCODE_TTL_DAYS} days')
     ON CONFLICT ("cacheKey") DO UPDATE SET
       "placeId"=EXCLUDED."placeId",
       "formattedAddress"=EXCLUDED."formattedAddress",
       granularity=EXCLUDED.granularity,
       latitude=EXCLUDED.latitude,
       longitude=EXCLUDED.longitude,
       types=EXCLUDED.types,
       "expiresAt"=EXCLUDED."expiresAt",
       "updatedAt"=now()`,
    [
      cacheKey,
      resolved.placeId,
      resolved.formattedAddress,
      resolved.granularity,
      resolved.latitude,
      resolved.longitude,
      JSON.stringify(resolved.types),
    ],
  ).catch(() => undefined);

  return resolved;
}

async function googleRoutes(originPlaceId: string, destinationPlaceId: string, apiKey: string) {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: { placeId: originPlaceId },
      destination: { placeId: destinationPlaceId },
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

async function osrmRoute(origin: DeliveryRoutePoint, destination: DeliveryRoutePoint) {
  const originLatitude = finiteCoordinate(origin.latitude);
  const originLongitude = finiteCoordinate(origin.longitude);
  const destinationLatitude = finiteCoordinate(destination.latitude);
  const destinationLongitude = finiteCoordinate(destination.longitude);
  if (originLatitude == null || originLongitude == null || destinationLatitude == null || destinationLongitude == null) return null;

  const baseUrl = String(process.env.OSRM_ROUTER_BASE_URL || DEFAULT_OSRM_BASE_URL).trim().replace(/\/$/, '');
  const coordinates = `${originLongitude},${originLatitude};${destinationLongitude},${destinationLatitude}`;
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

async function persistRouteCache(
  dataSource: DataSource,
  cacheKey: string,
  origin: DeliveryRoutePoint,
  destination: DeliveryRoutePoint,
  routed: { distanceMeters: number; durationSeconds: number | null; source: 'GOOGLE_ROUTES' | 'OSRM' },
  originResolved: GoogleResolvedWaypoint | null,
  destinationResolved: GoogleResolvedWaypoint | null,
) {
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
      originResolved?.latitude ?? finiteCoordinate(origin.latitude),
      originResolved?.longitude ?? finiteCoordinate(origin.longitude),
      destinationResolved?.latitude ?? finiteCoordinate(destination.latitude),
      destinationResolved?.longitude ?? finiteCoordinate(destination.longitude),
      routed.source,
      routed.distanceMeters,
      routed.durationSeconds,
      JSON.stringify({
        profile: 'driving',
        routingPreference: routed.source === 'GOOGLE_ROUTES' ? GOOGLE_ROUTING_PREFERENCE : null,
        waypointMode: routed.source === 'GOOGLE_ROUTES' ? 'GEOCODED_PLACE_ID' : 'LAT_LNG',
        originPlaceId: originResolved?.placeId || null,
        destinationPlaceId: destinationResolved?.placeId || null,
        originGranularity: originResolved?.granularity || null,
        destinationGranularity: destinationResolved?.granularity || null,
      }),
    ],
  ).catch(() => undefined);
}

function googleRouteCacheKey(origin: GoogleResolvedWaypoint, destination: GoogleResolvedWaypoint) {
  const value = [
    'delivery-route-v5',
    'GOOGLE_ROUTES',
    GOOGLE_ROUTING_PREFERENCE,
    origin.placeId,
    destination.placeId,
  ].join('|');
  return createHash('sha256').update(value).digest('hex');
}

function osrmRouteCacheKey(origin: DeliveryRoutePoint, destination: DeliveryRoutePoint) {
  const value = [
    'delivery-route-v5',
    'OSRM',
    rounded(origin.latitude),
    rounded(origin.longitude),
    rounded(destination.latitude),
    rounded(destination.longitude),
  ].join('|');
  return createHash('sha256').update(value).digest('hex');
}

function rowToResolvedWaypoint(row: any, geocodeCacheHit: boolean): GoogleResolvedWaypoint {
  return {
    placeId: String(row.placeId || '').trim(),
    formattedAddress: String(row.formattedAddress || '').trim() || null,
    latitude: finiteCoordinate(row.latitude),
    longitude: finiteCoordinate(row.longitude),
    granularity: String(row.granularity || '').trim().toUpperCase() || null,
    types: Array.isArray(row.types) ? row.types.map((item: unknown) => String(item)).filter(Boolean).slice(0, 20) : [],
    geocodeCacheHit,
  };
}

function validateResolvedCep(formattedAddress: string | null, rawZipCode: unknown) {
  const expected = digits(rawZipCode);
  if (!expected || !formattedAddress) return;
  const match = formattedAddress.match(/\b(\d{5})-?(\d{3})\b/);
  if (!match) return;
  const actual = `${match[1]}${match[2]}`;
  if (actual !== expected) {
    throw new Error(`Google Geocoding resolved CEP ${actual}, but delivery requested CEP ${expected}.`);
  }
}

function isPreciseGranularity(value: string | null) {
  return value === 'ROOFTOP' || value === 'RANGE_INTERPOLATED';
}

function normalizeAddress(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').slice(0, 500);
}

function rounded(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(5) : '';
}

function finiteCoordinate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
