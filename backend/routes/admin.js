const express = require('express');
const RouteConversionRule = require('../models/RouteConversionRule');
const Trip = require('../models/Trip');
const Remark = require('../models/Remark');
const Favorite = require('../models/Favorite');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendPush } = require('../utils/fcm');
const Schedule = require('../models/Schedule');
const ScheduledTrip = require('../models/ScheduledTrip');
const CrewAssignment = require('../models/CrewAssignment');
const VehicleStatus = require('../models/VehicleStatus');
const Bus = require('../models/Bus');
const PassengerFeedback = require('../models/PassengerFeedback');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

let io = null;
function setIo(socketIoInstance) {
  io = socketIoInstance;
}

router.post('/conversion-rules', async (req, res) => {
  const { fromRouteId, toRouteId, timeWindow } = req.body;
  const rule = await RouteConversionRule.create({ fromRouteId, toRouteId, timeWindow: timeWindow || null });
  res.status(201).json(rule);
});

// Timetable: a schedule groups recurring service; ScheduledTrip is the
// dispatchable departure for one operating date.
router.post('/schedules', async (req, res) => {
  const { routeId, name, operatingDays, timezone } = req.body;
  if (!routeId || !name) return res.status(422).json({ error: 'routeId and name are required' });
  res.status(201).json(await Schedule.create({ routeId, name, operatingDays, timezone }));
});

router.get('/schedules', async (req, res) => res.json(await Schedule.find(req.query.routeId ? { routeId: req.query.routeId } : {}).sort({ createdAt: -1 })));

router.post('/scheduled-trips', async (req, res) => {
  const { scheduleId, routeId, operatingDate, plannedDepartureAt, expectedStopTimes, busId, driverId, conductorId } = req.body;
  if (!scheduleId || !routeId || !operatingDate || !plannedDepartureAt) return res.status(422).json({ error: 'scheduleId, routeId, operatingDate and plannedDepartureAt are required' });
  if (busId) {
    const bus = await Bus.findById(busId);
    if (!bus || bus.status === 'maintenance' || bus.status === 'unavailable' || bus.readiness !== 'ready') return res.status(409).json({ error: 'Assigned bus is unavailable' });
  }
  res.status(201).json(await ScheduledTrip.create({ scheduleId, routeId, operatingDate, plannedDepartureAt, expectedStopTimes, busId, driverId, conductorId }));
});

router.patch('/scheduled-trips/:id/assignment', async (req, res) => {
  const { busId, driverId, conductorId } = req.body;
  if (busId) {
    const bus = await Bus.findById(busId);
    if (!bus || bus.status === 'maintenance' || bus.status === 'unavailable' || bus.readiness !== 'ready') return res.status(409).json({ error: 'Bus is unavailable' });
  }
  const scheduledTrip = await ScheduledTrip.findByIdAndUpdate(req.params.id, { busId, driverId, conductorId }, { new: true });
  if (!scheduledTrip) return res.status(404).json({ error: 'Scheduled trip not found' });
  await CrewAssignment.findOneAndUpdate({ scheduledTripId: scheduledTrip._id }, { scheduledTripId: scheduledTrip._id, busId, driverId, conductorId, assignedBy: req.user.id }, { upsert: true, new: true });
  res.json(scheduledTrip);
});

router.post('/scheduled-trips/:id/cancel', async (req, res) => {
  const scheduledTrip = await ScheduledTrip.findByIdAndUpdate(req.params.id, { status: 'cancelled', cancellationReason: req.body.reason || 'Cancelled by dispatch' }, { new: true });
  if (!scheduledTrip) return res.status(404).json({ error: 'Scheduled trip not found' });
  io?.to(`route:${scheduledTrip.routeId}`).emit('trip:status', { scheduledTripId: scheduledTrip._id, status: 'cancelled', reason: scheduledTrip.cancellationReason });
  res.json(scheduledTrip);
});

router.patch('/buses/:id/readiness', async (req, res) => {
  const { state = 'ready', checklist = [], note = null } = req.body;
  const stateToBus = { ready: 'idle', inspection_due: 'idle', maintenance: 'maintenance', unavailable: 'unavailable' };
  if (!(state in stateToBus)) return res.status(422).json({ error: 'Invalid readiness state' });
  const bus = await Bus.findByIdAndUpdate(req.params.id, { readiness: state, status: stateToBus[state], maintenanceNote: note, lastChecklistAt: new Date() }, { new: true });
  if (!bus) return res.status(404).json({ error: 'Bus not found' });
  const vehicleStatus = await VehicleStatus.findOneAndUpdate({ busId: bus._id }, { busId: bus._id, state, checklist, note, updatedBy: req.user.id }, { upsert: true, new: true });
  io?.to('admin').emit('bus:readiness', { busId: bus._id, state, note });
  res.json({ bus, vehicleStatus });
});

router.get('/fleet-board', async (req, res) => {
  const [buses, trips, vehicleStatuses] = await Promise.all([
    Bus.find(),
    Trip.find({ status: { $in: ['active', 'arrived'] } }).select('busId routeId driverId conductorId status lastPosition checkpointHistory delayMinutes occupancyBand gpsFreshness etaConfidence'),
    VehicleStatus.find(),
  ]);
  const statusByBus = new Map(vehicleStatuses.map((status) => [String(status.busId), status]));
  const tripByBus = new Map(trips.map((trip) => [String(trip.busId), trip]));
  res.json(buses.map((bus) => ({ ...bus.toObject(), liveTrip: tripByBus.get(String(bus._id)) || null, vehicleStatus: statusByBus.get(String(bus._id)) || null })));
});

router.get('/feedback', async (req, res) => res.json(await PassengerFeedback.find().sort({ createdAt: -1 }).limit(200)));
router.patch('/feedback/:id', async (req, res) => {
  const feedback = await PassengerFeedback.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!feedback) return res.status(404).json({ error: 'Feedback not found' });
  res.json(feedback);
});

// Manual broadcast announcement (Section 3.1 / Section 5).
router.post('/broadcast', async (req, res) => {
  const { message, routeId } = req.body;

  if (routeId) {
    io?.to(`route:${routeId}`).emit('admin:broadcast', { message, routeId });
    const userIds = await Favorite.find({ routeId }).distinct('userId');
    const tokens = await User.find({ _id: { $in: userIds }, fcmToken: { $ne: null } }).distinct('fcmToken');
    await sendPush(tokens, 'BusTracker announcement', message, { routeId });
  } else {
    io?.emit('admin:broadcast', { message });
    const tokens = await User.find({ role: 'passenger', fcmToken: { $ne: null } }).distinct('fcmToken');
    await sendPush(tokens, 'BusTracker announcement', message, {});
  }

  res.status(201).json({ ok: true });
});

// Section 6.3 analytics: on-time %, average delay by route, most-favorited stops
// (schema has no scheduled-timetable or stop-visit log, so these are the closest
// proxies available from trips/remarks/favorites data).
router.get('/analytics/summary', async (req, res) => {
  const trips = await Trip.find({ status: 'completed' }).select('routeId startedAt endedAt');

  const stallCountsByTrip = await Remark.aggregate([
    { $match: { source: 'system', tag: 'traffic' } },
    { $group: { _id: '$tripId', count: { $sum: 1 } } },
  ]);
  const stallTripIds = new Set(stallCountsByTrip.map((r) => String(r._id)));

  const byRoute = {};
  for (const trip of trips) {
    const key = String(trip.routeId);
    byRoute[key] ??= { routeId: trip.routeId, tripCount: 0, onTimeCount: 0, totalDurationMin: 0 };
    byRoute[key].tripCount += 1;
    if (!stallTripIds.has(String(trip._id))) byRoute[key].onTimeCount += 1;
    if (trip.endedAt) byRoute[key].totalDurationMin += (trip.endedAt - trip.startedAt) / 60000;
  }

  const analytics = Object.values(byRoute).map((r) => ({
    routeId: r.routeId,
    tripCount: r.tripCount,
    onTimePercent: r.tripCount ? Math.round((r.onTimeCount / r.tripCount) * 100) : null,
    avgTripDurationMin: r.tripCount ? Math.round(r.totalDurationMin / r.tripCount) : null,
  }));

  const mostFavoritedStops = await Favorite.aggregate([
    { $group: { _id: '$stopId', favoriteCount: { $sum: 1 } } },
    { $sort: { favoriteCount: -1 } },
    { $limit: 10 },
  ]);

  res.json({ byRoute: analytics, mostFavoritedStops });
});

module.exports = { router, setIo };
