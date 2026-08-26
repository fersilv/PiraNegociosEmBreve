export type UserCoordinates = { latitude: number; longitude: number; accuracy?: number; capturedAt: number };

const STORAGE_KEY = 'piranegocios:user-location:v1';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function readCachedUserLocation(): UserCoordinates | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as UserCoordinates | null;
    if (!parsed || !Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    if (Date.now() - Number(parsed.capturedAt || 0) > MAX_AGE_MS) return null;
    return parsed;
  } catch { return null; }
}

export function requestUserLocation(options: { prompt?: boolean; maximumAge?: number } = {}) {
  const cached = readCachedUserLocation();
  if (cached) return Promise.resolve(cached);
  if (!('geolocation' in navigator)) return Promise.resolve(null);

  return new Promise<UserCoordinates | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const value: UserCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: Date.now(),
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* no-op */ }
        resolve(value);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: options.prompt === false ? 2500 : 7000, maximumAge: options.maximumAge ?? MAX_AGE_MS },
    );
  });
}

export async function bestEffortUserLocation() {
  const cached = readCachedUserLocation();
  if (cached) return cached;
  try {
    const permissionApi = (navigator as any).permissions;
    if (permissionApi?.query) {
      const status = await permissionApi.query({ name: 'geolocation' });
      if (status?.state === 'granted') return requestUserLocation({ prompt: false });
      // Não abre popup automaticamente só para ordenar uma vitrine.
      if (status?.state === 'prompt') return null;
    }
  } catch { /* browser sem Permissions API */ }
  return null;
}
