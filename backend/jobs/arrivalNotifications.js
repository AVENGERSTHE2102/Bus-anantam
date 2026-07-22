const Trip = require('../models/Trip');
const Favorite = require('../models/Favorite');
const Stop = require('../models/Stop');
const User = require('../models/User');
const haversineKm = require('../utils/haversine');
const { sendPush } = require('../utils/fcm');
const { ARRIVAL_NOTIFY_MINUTES } = require('../config/constants');

// Section 5: "Bus arriving within N min of passenger's stop" push, driven off
// favorited stops since the schema has no separate route-subscription table.
// Naive straight-line ETA (distance / current speed) — same approximation as
// the /trips/:id/eta endpoint; good enough to decide "notify now or not".
async function runArrivalNotifications() {
  const activeTrips = await Trip.find({ status: 'active', 'lastPosition.location': { $ne: null } });

  for (const trip of activeTrips) {
    if (!trip.lastPosition.speedKmph) continue;

    const favorites = await Favorite.find({
      routeId: trip.routeId,
      stopId: { $nin: trip.notifiedStopIds },
    });
    const stops = favorites.length ? await Stop.find({ _id: { $in: favorites.map((f) => f.stopId) } }) : [];
    const stopsById = new Map(stops.map((s) => [String(s._id), s]));

    const dueFavorites = favorites.filter((fav) => {
      const stop = stopsById.get(String(fav.stopId));
      if (!stop) return false;
      const distanceKm = haversineKm(trip.lastPosition.location.coordinates, stop.location.coordinates);
      const etaMinutes = (distanceKm / trip.lastPosition.speedKmph) * 60;
      return etaMinutes <= ARRIVAL_NOTIFY_MINUTES;
    });
    if (dueFavorites.length) {
      const users = await User.find({ _id: { $in: dueFavorites.map((f) => f.userId) }, fcmToken: { $ne: null } });
      for (const user of users) {
        const stop = stopsById.get(String(dueFavorites.find((f) => String(f.userId) === String(user._id)).stopId));
        await sendPush([user.fcmToken], 'Bus arriving soon', `Bus arriving in ~${ARRIVAL_NOTIFY_MINUTES} min at ${stop.name}`);
      }

      trip.notifiedStopIds.push(...dueFavorites.map((f) => f.stopId));
      await trip.save();
    }

  }
}

module.exports = runArrivalNotifications;
