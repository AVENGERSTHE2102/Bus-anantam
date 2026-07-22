// Snaps a raw GPS point onto the route polyline so buses don't appear to
// teleport off-road (Section 9 accuracy tolerance / Phase 4 map-matching).
// Pure geometry, no dependency: projects the point onto each segment and
// keeps the closest one.
function projectOntoSegment([px, py], [ax, ay], [bx, by]) {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
  return [ax + t * abx, ay + t * aby];
}

function distanceSq([x1, y1], [x2, y2]) {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
}

// point and polylineCoords are GeoJSON [lng, lat] pairs.
function snapToPolyline(point, polylineCoords) {
  if (!polylineCoords?.length) return point;

  let best = polylineCoords[0];
  let bestDistSq = Infinity;

  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const candidate = projectOntoSegment(point, polylineCoords[i], polylineCoords[i + 1]);
    const distSq = distanceSq(point, candidate);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = candidate;
    }
  }

  return best;
}

module.exports = { snapToPolyline };
