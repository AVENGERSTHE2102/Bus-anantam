// Reverse geocoding for stall-detection messages ("stuck near X"). Section 4.6.
// Defaults to the public rate-limited OSM instance; set NOMINATIM_BASE_URL to a
// self-hosted instance for production volume.
const BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';

async function reverseGeocode(lat, lng) {
  try {
    const url = `${BASE_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BusTracker/1.0' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

module.exports = { reverseGeocode };
