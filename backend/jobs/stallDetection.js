const Trip = require('../models/Trip');
const Remark = require('../models/Remark');
const { reverseGeocode } = require('../utils/nominatim');
const { STALL_MINUTES, STALL_REMARK_COOLDOWN_MINUTES } = require('../config/constants');

// Section 4.6 automated stall detection: a bus stuck below walking speed for
// STALL_MINUTES gets an auto-generated system remark, throttled so it doesn't
// spam one every job tick while the bus stays stuck.
async function runStallDetection(io) {
  const cutoff = new Date(Date.now() - STALL_MINUTES * 60_000);
  const stalledTrips = await Trip.find({ status: 'active', lowSpeedSince: { $ne: null, $lte: cutoff } });

  for (const trip of stalledTrips) {
    const cooldownCutoff = new Date(Date.now() - STALL_REMARK_COOLDOWN_MINUTES * 60_000);
    if (trip.lastStallRemarkAt && trip.lastStallRemarkAt > cooldownCutoff) continue;

    const [lng, lat] = trip.lastPosition.location.coordinates;
    const placeName = await reverseGeocode(lat, lng);
    const message = placeName
      ? `Bus is stuck in traffic near ${placeName}. Estimated delay: ~${STALL_MINUTES} min.`
      : `Bus is stuck in traffic. Estimated delay: ~${STALL_MINUTES} min.`;

    const remark = await Remark.create({
      tripId: trip._id,
      source: 'system',
      tag: 'traffic',
      message,
      location: trip.lastPosition.location,
    });

    trip.lastStallRemarkAt = new Date();
    await trip.save();

    io.to(`route:${trip.routeId}`).emit('remark:new', remark);
    io.to('admin').emit('remark:new', remark);
  }
}

module.exports = runStallDetection;
