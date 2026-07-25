const Trip = require('../models/Trip');

const LIVE_FLEET_ROOM = 'live-fleet';

async function getActiveFleetSnapshot() {
  const trips = await Trip.find({ status: { $in: ['active', 'arrived'] } })
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

module.exports = { LIVE_FLEET_ROOM, getActiveFleetSnapshot, emitLiveFleetSnapshot };
