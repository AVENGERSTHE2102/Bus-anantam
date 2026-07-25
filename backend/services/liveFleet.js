const Trip = require('../models/Trip');

const LIVE_FLEET_ROOM = 'live-fleet';
// A phone with a dead app, lost network, or an abandoned shift must stop
// appearing as a real vehicle. GTFS-Realtime recommends vehicle position data
// no older than 90 seconds; keep the same operational boundary here.
const LIVE_POSITION_MAX_AGE_MS = Number(process.env.LIVE_POSITION_MAX_AGE_MS || 90_000);

async function getActiveFleetSnapshot() {
  const trips = await Trip.find({
    status: { $in: ['active', 'arrived'] },
    'lastPosition.location.coordinates.0': { $exists: true },
    'lastPosition.recordedAt': { $gte: new Date(Date.now() - LIVE_POSITION_MAX_AGE_MS) },
  })
    .select('busId routeId driverId conductorId status startedAt endedAt lastPosition checkpointHistory passengerCount occupancyBand delayMinutes etaConfidence gpsFreshness')
    .lean();

  // Socket.IO serialises ObjectIds, but normalising them here keeps HTTP and
  // socket payloads identical and avoids device-specific comparison bugs.
  return trips.map((trip) => ({
    ...trip,
    _id: String(trip._id),
    busId: String(trip.busId),
    routeId: String(trip.routeId),
    checkpointHistory: (trip.checkpointHistory || []).map((checkpoint) => ({
      ...checkpoint,
      stopId: String(checkpoint.stopId),
    })),
  }));
}

async function emitLiveFleetSnapshot(target) {
  const trips = await getActiveFleetSnapshot();
  target.emit('fleet:snapshot', { trips, updatedAt: new Date().toISOString() });
  return trips;
}

module.exports = { LIVE_FLEET_ROOM, LIVE_POSITION_MAX_AGE_MS, getActiveFleetSnapshot, emitLiveFleetSnapshot };
