// Naive straight-line ETA, mirrors the backend's utils/haversine.js — kept as a
// tiny standalone copy since the frontend can't require the backend's CommonJS module.
const EARTH_RADIUS_KM = 6371;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function etaMinutes(distanceKm: number, speedKmph: number) {
  if (!speedKmph) return null;
  return Math.max(1, Math.round((distanceKm / speedKmph) * 60));
}
