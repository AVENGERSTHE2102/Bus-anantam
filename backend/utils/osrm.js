// Self-hosted OSRM (Section 4.4 v1.1 road-network ETA). Returns null if unconfigured
// or unreachable so callers can fall back to the naive haversine ETA.
async function osrmDurationMinutes([fromLng, fromLat], [toLng, toLat]) {
  const baseUrl = process.env.OSRM_BASE_URL;
  if (!baseUrl) return null;

  try {
    const url = `${baseUrl}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    const seconds = data?.routes?.[0]?.duration;
    return typeof seconds === 'number' ? seconds / 60 : null;
  } catch {
    return null;
  }
}

// Matches a rolling GPS trace to the most plausible road path. Unlike a
// nearest-road snap, Match uses the direction and continuity of recent points.
// Returns the latest matched [lng, lat] coordinate or null when OSRM cannot
// confidently match the trace.
async function osrmMatchLatest(samples) {
  const baseUrl = process.env.OSRM_BASE_URL;
  if (!baseUrl || samples.length < 2) return null;

  try {
    const coordinates = samples.map(({ lng, lat }) => `${lng},${lat}`).join(';');
    const url = `${baseUrl}/match/v1/driving/${coordinates}?overview=false&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    const latest = data?.tracepoints?.[data.tracepoints.length - 1]?.location;
    return Array.isArray(latest) && latest.length === 2 ? latest : null;
  } catch {
    return null;
  }
}

module.exports = { osrmDurationMinutes, osrmMatchLatest };
