export interface VisitorLocationHint {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: "cloudflare" | null;
}

export interface LocalityRecommendation {
  detectedLabel: string | null;
  recommendedLabel: string | null;
  exact: boolean;
  distanceKm: number | null;
  cityOrder: string[];
}

type Coordinates = { latitude: number; longitude: number };

const REGIONAL_COORDINATES: Record<string, Coordinates> = {
  "pirassununga|sp": { latitude: -21.9960, longitude: -47.4257 },
  "leme|sp": { latitude: -22.1856, longitude: -47.3908 },
  "araras|sp": { latitude: -22.3572, longitude: -47.3842 },
  "limeira|sp": { latitude: -22.5646, longitude: -47.4017 },
  "santa cruz da conceicao|sp": { latitude: -22.1403, longitude: -47.4512 },
  "porto ferreira|sp": { latitude: -21.8533, longitude: -47.4792 },
  "descalvado|sp": { latitude: -21.9039, longitude: -47.6194 },
  "santa rita do passa quatro|sp": { latitude: -21.7083, longitude: -47.4780 },
  "santa cruz das palmeiras|sp": { latitude: -21.8269, longitude: -47.2486 },
  "tambau|sp": { latitude: -21.7041, longitude: -47.2744 },
  "casa branca|sp": { latitude: -21.7708, longitude: -47.0868 },
  "sao carlos|sp": { latitude: -22.0174, longitude: -47.8908 },
  "rio claro|sp": { latitude: -22.4114, longitude: -47.5614 },
  "corumbatai|sp": { latitude: -22.2198, longitude: -47.6254 },
  "analandia|sp": { latitude: -22.1289, longitude: -47.6619 },
  "piracicaba|sp": { latitude: -22.7253, longitude: -47.6492 },
  "aguai|sp": { latitude: -22.0572, longitude: -46.9735 },
  "mogi guacu|sp": { latitude: -22.3675, longitude: -46.9455 },
  "mogi mirim|sp": { latitude: -22.4319, longitude: -46.9576 },
  "sao joao da boa vista|sp": { latitude: -21.9707, longitude: -46.7984 },
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseLocationLabel(value: string) {
  const clean = String(value || "").trim();
  const match = clean.match(/^(.+?)(?:\s*,\s*|\s*\/\s*)([A-Z]{2})$/i);
  const city = (match?.[1] || clean).trim();
  const state = (match?.[2] || "SP").toUpperCase();
  return { city, state, key: `${normalize(city)}|${normalize(state)}` };
}

function sameLocation(a: string, b: string) {
  const parsedA = parseLocationLabel(a);
  const parsedB = parseLocationLabel(b);
  return parsedA.key === parsedB.key;
}

function haversineKm(a: Coordinates, b: Coordinates) {
  const radius = 6371;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDistance = radians(b.latitude - a.latitude);
  const lonDistance = radians(b.longitude - a.longitude);
  const aLat = radians(a.latitude);
  const bLat = radians(b.latitude);
  const value =
    Math.sin(latDistance / 2) ** 2 +
    Math.sin(lonDistance / 2) ** 2 * Math.cos(aLat) * Math.cos(bLat);
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function visitorCoordinates(hint: VisitorLocationHint): Coordinates | null {
  const latitude = typeof hint.latitude === "number" ? hint.latitude : Number.NaN;
  const longitude = typeof hint.longitude === "number" ? hint.longitude : Number.NaN;
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
  if (hint.city && hint.state) {
    return REGIONAL_COORDINATES[`${normalize(hint.city)}|${normalize(hint.state)}`] || null;
  }
  return null;
}

export function buildLocalityRecommendation(
  hint: VisitorLocationHint | null | undefined,
  availableLocations: string[],
): LocalityRecommendation | null {
  if (!hint?.city || (hint.country && normalize(hint.country) !== "br")) return null;
  if (!availableLocations.length) return null;

  const detectedLabel = `${hint.city}${hint.state ? `, ${hint.state}` : ""}`;
  const exact = availableLocations.find((location) => sameLocation(location, detectedLabel)) || null;
  const origin = visitorCoordinates(hint);

  const ranked = availableLocations
    .map((label, index) => {
      if (exact && sameLocation(label, exact)) return { label, distance: 0, index };
      const parsed = parseLocationLabel(label);
      const coordinates = REGIONAL_COORDINATES[parsed.key];
      return {
        label,
        distance: origin && coordinates ? haversineKm(origin, coordinates) : Number.POSITIVE_INFINITY,
        index,
      };
    })
    .sort((a, b) => a.distance - b.distance || a.index - b.index);

  const recommended = exact || ranked.find((item) => Number.isFinite(item.distance))?.label || availableLocations[0] || null;
  const distanceKm = recommended
    ? ranked.find((item) => sameLocation(item.label, recommended) && Number.isFinite(item.distance))?.distance ?? null
    : null;

  return {
    detectedLabel,
    recommendedLabel: recommended,
    exact: Boolean(exact),
    distanceKm,
    cityOrder: ranked.map((item) => item.label),
  };
}

export function localityRank(label: string, recommendation: LocalityRecommendation | null) {
  if (!recommendation) return Number.MAX_SAFE_INTEGER;
  const index = recommendation.cityOrder.findIndex((location) => sameLocation(location, label));
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}