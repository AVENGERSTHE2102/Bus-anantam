const Trip = require('../models/Trip');
const Route = require('../models/Route');
const Stop = require('../models/Stop');
const RouteConversionRule = require('../models/RouteConversionRule');
const haversineKm = require('../utils/haversine');
const { osrmDurationMinutes, osrmMatchLatest } = require('../utils/osrm');
const { snapToPolyline } = require('../utils/polyline');
const { STALL_SPEED_KMPH, GEOFENCE_RADIUS_METERS } = require('../config/constants');
const { syncArrivalEstimate, markCheckpointArrival, confidenceFor } = require('./operations');

const ETA_UPDATE_INTERVAL_MS = Number(process.env.ETA_UPDATE_INTERVAL_MS || 15_000);
const lastEtaUpdateAt = new Map();
const gpsTrails = new Map();
const MAX_MATCH_SAMPLES = 6;
const routeCache = new Map();
const stopsCache = new Map();
const CACHE_TTL_MS = 60_000;

async function cachedRoute(routeId) {
  const cached = routeCache.get(String(routeId));
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const value = await Route.findById(routeId).select('polyline endLocation');
  routeCache.set(String(routeId), { at: Date.now(), value });
  return value;
}

async function cachedStops(routeId) {
  const cached = stopsCache.get(String(routeId));
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const value = await Stop.find({ routeId }).sort({ sequenceOrder: 1 });
  stopsCache.set(String(routeId), { at: Date.now(), value });
  return value;
}

async function recordLocation(io, { tripId, user, lat, lng, speed, heading, capturedAt }) {
  const trip = await Trip.findById(tripId);
  if (!trip || String(trip.driverId) !== String(user.id) || trip.status !== 'active') return null;
  if (![lat, lng, speed, heading].every(Number.isFinite)) return null;

  const trail = addGpsSample(tripId, { lat, lng, capturedAt });
  const matchedCoords = await osrmMatchLatest(trail);
  // OSRM can be unavailable or reject a sparse/noisy trace. In that case keep
  // the current route-polyline snap as a safe fallback.
  const route = await cachedRoute(trip.routeId);
  const positionCoords = matchedCoords || (route?.polyline?.coordinates?.length
    ? snapToPolyline([lng, lat], route.polyline.coordinates)
    : [lng, lat]);
  const [matchedLng, matchedLat] = positionCoords;
  const checkpoint = await getCheckpointProgress(route, trip.routeId, positionCoords);

  trip.lastPosition = {
    location: { type: 'Point', coordinates: positionCoords },
    speedKmph: speed,
    heading,
    recordedAt: capturedAt ? new Date(capturedAt) : new Date(),
  };
  trip.lowSpeedSince = speed < STALL_SPEED_KMPH ? (trip.lowSpeedSince || new Date()) : null;
  trip.gpsFreshness = 'fresh';
  trip.etaConfidence = confidenceFor(trip, Boolean(matchedCoords));
  const checkpointArrival = checkpoint?.currentStop ? await markCheckpointArrival(trip, checkpoint.currentStop) : null;
  await trip.save();

  io.to(`route:${trip.routeId}`).emit('bus:position', {
    tripId: trip._id,
    busId: trip.busId,
    lat: matchedLat,
    lng: matchedLng,
    speed,
    heading,
    ...(checkpoint ? { currentStopIndex: checkpoint.currentStopIndex, stopsLeft: checkpoint.stopsLeft, nextStopId: checkpoint.nextStopId } : {}),
    occupancyBand: trip.occupancyBand, delayMinutes: trip.delayMinutes, gpsFreshness: trip.gpsFreshness, etaConfidence: trip.etaConfidence,
  });
  if (checkpointArrival) io.to(`route:${trip.routeId}`).emit('checkpoint:arrival', { tripId: trip._id, busId: trip.busId, ...checkpointArrival, delayMinutes: trip.delayMinutes });
  publishNextStopEta(io, trip).catch((err) => console.error('ETA update failed:', err));
  await checkTerminusArrival(io, trip, positionCoords);
  return trip;
}

// Convert the matched position into route progress. This drives checkpoint UI
// and prevents it from relying on a fake timer once real GPS is flowing.
async function getCheckpointProgress(route, routeId, positionCoords) {
  const stops = await cachedStops(routeId);
  if (!stops.length) return null;
  if (!route?.polyline?.coordinates?.length) {
    let nearestStopIndex = 0;
    let nearestDistance = Infinity;
    stops.forEach((stop, index) => {
      const distance = haversineKm(positionCoords, stop.location.coordinates);
      if (distance < nearestDistance) { nearestDistance = distance; nearestStopIndex = index; }
    });
    const currentStopIndex = nearestDistance < 0.1 ? nearestStopIndex : Math.max(0, nearestStopIndex - 1);
    return { currentStopIndex, stopsLeft: Math.max(0, stops.length - 1 - currentStopIndex), currentStop: nearestDistance < 0.075 ? stops[nearestStopIndex] : null, nextStopId: String(stops[Math.min(currentStopIndex + 1, stops.length - 1)]._id) };
  }

  const nearestPolylineIndex = findNearestPolylineIndex(positionCoords, route.polyline.coordinates);
  let currentStopIndex = 0;
  stops.forEach((stop, index) => {
    if (findNearestPolylineIndex(stop.location.coordinates, route.polyline.coordinates) <= nearestPolylineIndex) {
      currentStopIndex = index;
    }
  });
  return { currentStopIndex, stopsLeft: Math.max(0, stops.length - 1 - currentStopIndex), currentStop: stops[currentStopIndex], nextStopId: String(stops[Math.min(currentStopIndex + 1, stops.length - 1)]._id) };
}

function findNearestPolylineIndex([lng, lat], coordinates) {
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  coordinates.forEach(([candidateLng, candidateLat], index) => {
    const distance = (candidateLng - lng) ** 2 + (candidateLat - lat) ** 2;
    if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
  });
  return nearestIndex;
}

function addGpsSample(tripId, { lat, lng, capturedAt }) {
  const key = String(tripId);
  const trail = gpsTrails.get(key) || [];
  trail.push({ lat, lng, capturedAt: capturedAt || new Date().toISOString() });
  const recentTrail = trail.slice(-MAX_MATCH_SAMPLES);
  gpsTrails.set(key, recentTrail);
  return recentTrail;
}

async function publishNextStopEta(io, trip) {
  const now = Date.now();
  if (now - (lastEtaUpdateAt.get(String(trip._id)) || 0) < ETA_UPDATE_INTERVAL_MS) return;
  lastEtaUpdateAt.set(String(trip._id), now);
  const [route, stops] = await Promise.all([
    cachedRoute(trip.routeId),
    cachedStops(trip.routeId),
  ]);
  if (!stops.length || !trip.lastPosition?.location) return;

  const rawCoords = trip.lastPosition.location.coordinates;
  const busCoords = route?.polyline?.coordinates?.length
    ? snapToPolyline(rawCoords, route.polyline.coordinates)
    : rawCoords;
  let nearestIndex = 0;
  let nearestKm = Infinity;
  stops.forEach((stop, index) => {
    const distanceKm = haversineKm(busCoords, stop.location.coordinates);
    if (distanceKm < nearestKm) { nearestKm = distanceKm; nearestIndex = index; }
  });
  const nextStop = stops[nearestKm < 0.075 ? Math.min(nearestIndex + 1, stops.length - 1) : nearestIndex];
  const osrmMinutes = await osrmDurationMinutes(busCoords, nextStop.location.coordinates);
  const speedKmph = Math.max(Number(trip.lastPosition.speedKmph) || 0, 8);
  const etaMinutes = osrmMinutes ?? (haversineKm(busCoords, nextStop.location.coordinates) / speedKmph) * 60;
  const confidence = confidenceFor(trip, osrmMinutes !== null);
  trip.etaConfidence = confidence;
  await trip.save();
  await syncArrivalEstimate(trip, route, nextStop);
  io.to(`route:${trip.routeId}`).emit('bus:eta-update', {
    tripId: trip._id, stopId: nextStop._id, etaMinutes: Math.max(1, Math.round(etaMinutes)),
    source: osrmMinutes !== null ? 'osrm' : 'speed-estimate', confidence, updatedAt: new Date().toISOString(),
  });
}

async function checkTerminusArrival(io, trip, coords) {
  const route = await cachedRoute(trip.routeId);
  if (!route?.endLocation || haversineKm(coords, route.endLocation.coordinates) * 1000 > GEOFENCE_RADIUS_METERS) return;
  trip.status = 'arrived';
  trip.arrivedAt = new Date();
  await trip.save();
  const rule = await RouteConversionRule.findOne({ fromRouteId: trip.routeId });
  io.to(`route:${trip.routeId}`).emit('trip:conversion-suggested', {
    tripId: trip._id, suggestedRouteId: rule?.toRouteId || null,
  });
}

module.exports = { recordLocation };
