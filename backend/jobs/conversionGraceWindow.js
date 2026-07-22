const Trip = require('../models/Trip');
const RouteConversionRule = require('../models/RouteConversionRule');
const { CONVERSION_GRACE_MINUTES } = require('../config/constants');

// Section 4.5: if nobody confirms the terminus conversion within the grace
// window and a default rule exists, auto-convert so tracking doesn't gap.
async function runConversionGraceWindow(io) {
  const cutoff = new Date(Date.now() - CONVERSION_GRACE_MINUTES * 60_000);
  const overdueTrips = await Trip.find({ status: 'arrived', arrivedAt: { $lte: cutoff } });

  for (const trip of overdueTrips) {
    const rule = await RouteConversionRule.findOne({ fromRouteId: trip.routeId });
    if (!rule) continue; // no default rule to auto-convert to; leave for manual confirmation

    trip.status = 'completed';
    trip.endedAt = new Date();
    await trip.save();

    const newTrip = await Trip.create({
      busId: trip.busId,
      routeId: rule.toRouteId,
      driverId: trip.driverId,
      conductorId: trip.conductorId,
      status: 'active',
    });

    io.to(`route:${trip.routeId}`).emit('trip:converted', {
      oldTripId: trip._id,
      newTripId: newTrip._id,
      toRouteId: rule.toRouteId,
      auto: true,
    });
    io.to(`route:${rule.toRouteId}`).emit('trip:converted', {
      oldTripId: trip._id,
      newTripId: newTrip._id,
      toRouteId: rule.toRouteId,
      auto: true,
    });
  }
}

module.exports = runConversionGraceWindow;
