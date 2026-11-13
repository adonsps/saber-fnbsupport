export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function parseLatLng(latRaw: unknown, lngRaw: unknown): LatLng | null {
  if (latRaw === undefined || latRaw === null || latRaw === '') return null;
  if (lngRaw === undefined || lngRaw === null || lngRaw === '') return null;
  const lat = typeof latRaw === 'number' ? latRaw : Number(String(latRaw).trim());
  const lng = typeof lngRaw === 'number' ? lngRaw : Number(String(lngRaw).trim());
  if (!isValidLatLng(lat, lng)) return null;
  return {
    lat: Math.round(lat * 1_000_000) / 1_000_000,
    lng: Math.round(lng * 1_000_000) / 1_000_000,
  };
}

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function buildOsmEmbedUrl(lat: number, lng: number): string {
  const delta = 0.0045;
  const minLng = lng - delta;
  const minLat = lat - delta;
  const maxLng = lng + delta;
  const maxLat = lat + delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
}
