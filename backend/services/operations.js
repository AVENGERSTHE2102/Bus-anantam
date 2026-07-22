const Trip = require('../models/Trip');
const ScheduledTrip = require('../models/ScheduledTrip');
const Stop = require('../models/Stop');
const StopArrival = require('../models/StopArrival');
const haversineKm = require('../utils/haversine');
const { osrmDurationMinutes } = require('../utils/osrm');
const { snapToPolyline } = require('../utils/polyline');

function todayInIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function confidenceFor(trip, osrmUsed) {
  const ageMinutes = trip.lastPosition?.recordedAt ? (Date.now() - new Date(trip.lastPosition.recordedAt)) / 60000 : Infinity;
  if (ageMinutes <= 1 && Number(trip.lastPosition?.speedKmph) >= 5 && osrmUsed) return 'high';
  if (ageMinutes <= 4) return 'medium';
  return 'limited';
}

async function estimateStopArrival(trip, route, stop) {
  if (!trip.lastPosition?.location) return null;
  const rawCoords = trip.lastPosition.location.coordinates;
  const busCoords = route?.polyline?.coordinates?.length ? snapToPolyline(rawCoords, route.polyline.coordinates) : rawCoords;
  const osrmMinutes = await osrmDurationMinutes(busCoords, stop.location.coordinates);
  const speed = Math.max(Number(trip.lastPosition.speedKmph) || 0, 8);
  const etaMinutes = Math.max(1, Math.round(osrmMinutes ?? (haversineKm(busCoords, stop.location.coordinates) / speed) * 60));
  return { etaMinutes, estimatedAt: new Date(Date.now() + etaMinutes * 60000), source: osrmMinutes !== null ? 'osrm' : 'speed-estimate', confidence: confidenceFor(trip, osrmMinutes !== null) };
}

async function syncArrivalEstimate(trip, route, stop) {
  const estimate = await estimateStopArrival(trip, route, stop);
  if (!estimate) return null;
  const scheduled = trip.scheduledTripId ? await ScheduledTrip.findById(trip.scheduledTripId).select('expectedStopTimes') : null;
  const plannedAt = scheduled?.expectedStopTimes.find((entry) => String(entry.stopId) === String(stop._id))?.plannedAt || null;
  await StopArrival.findOneAndUpdate(
    { tripId: trip._id, stopId: stop._id },
    { tripId: trip._id, scheduledTripId: trip.scheduledTripId, routeId: trip.routeId, stopId: stop._id, plannedAt, estimatedAt: estimate.estimatedAt, etaConfidence: estimate.confidence },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return estimate;
}

async function markCheckpointArrival(trip, stop) {
  if (trip.checkpointHistory.some((entry) => String(entry.stopId) === String(stop._id))) return null;
  const scheduled = trip.scheduledTripId ? await ScheduledTrip.findById(trip.scheduledTripId).select('expectedStopTimes') : null;
  const plannedAt = scheduled?.expectedStopTimes.find((entry) => String(entry.stopId) === String(stop._id))?.plannedAt || null;
  const arrivedAt = new Date();
  trip.checkpointHistory.push({ stopId: stop._id, arrivedAt, plannedAt });
  if (plannedAt) trip.delayMinutes = Math.round((arrivedAt - plannedAt) / 60000);
  await StopArrival.findOneAndUpdate(
    { tripId: trip._id, stopId: stop._id },
    { tripId: trip._id, scheduledTripId: trip.scheduledTripId, routeId: trip.routeId, stopId: stop._id, plannedAt, estimatedAt: arrivedAt, arrivedAt, etaConfidence: trip.etaConfidence },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return { stopId: String(stop._id), arrivedAt, plannedAt };
}

async function getRouteServiceStatus(routeId) {
  const [activeTrips, scheduled, stops] = await Promise.all([
    Trip.find({ routeId, status: { $in: ['active', 'arrived'] } }).select('busId status lastPosition checkpointHistory delayMinutes etaConfidence occupancyBand gpsFreshness'),
    ScheduledTrip.find({ routeId, operatingDate: todayInIndia() }).sort({ plannedDepartureAt: 1 }),
    Stop.find({ routeId }).sort({ sequenceOrder: 1 }).select('_id name'),
  ]);
  const ordered = activeTrips.map((trip) => ({
    ...trip.toObject(),
    progress: trip.checkpointHistory.length,
    nextCheckpoint: stops[Math.min(trip.checkpointHistory.length, Math.max(0, stops.length - 1))] || null,
  })).sort((a, b) => b.progress - a.progress || new Date(a.lastPosition?.recordedAt || 0) - new Date(b.lastPosition?.recordedAt || 0));
  const fleet = ordered.map((trip, index) => {
    const ahead = index ? ordered[index - 1] : null;
    // Fixed-route pilot: each checkpoint is approximately 1.5 minutes apart.
    const headwayMinutes = ahead ? Math.max(0, Math.round((ahead.progress - trip.progress) * 1.5)) : null;
    return { ...trip, headwayToBusAheadMinutes: headwayMinutes, headwayState: headwayMinutes === null ? 'leading' : headwayMinutes <= 3 ? 'bunching' : headwayMinutes >= 15 ? 'long_gap' : 'normal' };
  });
  return { activeTrips: fleet, scheduledTrips: scheduled };
}

module.exports = { confidenceFor, estimateStopArrival, syncArrivalEstimate, markCheckpointArrival, getRouteServiceStatus, todayInIndia };
