const express = require('express');
const Route = require('../models/Route');
const Stop = require('../models/Stop');
const Trip = require('../models/Trip');
const ScheduledTrip = require('../models/ScheduledTrip');
const StopArrival = require('../models/StopArrival');
const PassengerFeedback = require('../models/PassengerFeedback');
const { syncArrivalEstimate, getRouteServiceStatus, todayInIndia } = require('../services/operations');

const router = express.Router();

router.get('/routes/:routeId/schedule', async (req, res) => {
  const date = req.query.date || todayInIndia();
  const trips = await ScheduledTrip.find({ routeId: req.params.routeId, operatingDate: date }).sort({ plannedDepartureAt: 1 });
  res.json(trips);
});

router.get('/stops/:stopId/arrivals', async (req, res) => {
  const stop = await Stop.findById(req.params.stopId);
  if (!stop) return res.status(404).json({ error: 'Stop not found' });
  const route = await Route.findById(stop.routeId).select('polyline');
  const activeTrips = await Trip.find({ routeId: stop.routeId, status: 'active' });
  const live = [];
  for (const trip of activeTrips) {
    const estimate = await syncArrivalEstimate(trip, route, stop);
    if (estimate) live.push({ tripId: trip._id, busId: trip.busId, status: trip.status, occupancyBand: trip.occupancyBand, delayMinutes: trip.delayMinutes, ...estimate });
  }
  const date = req.query.date || todayInIndia();
  const scheduled = await ScheduledTrip.find({ routeId: stop.routeId, operatingDate: date }).select('plannedDepartureAt expectedStopTimes status cancellationReason liveTripId');
  const timetable = scheduled.map((scheduledTrip) => ({
    scheduledTripId: scheduledTrip._id,
    liveTripId: scheduledTrip.liveTripId,
    status: scheduledTrip.status,
    cancellationReason: scheduledTrip.cancellationReason,
    plannedAt: scheduledTrip.expectedStopTimes.find((entry) => String(entry.stopId) === String(stop._id))?.plannedAt || null,
  })).filter((item) => item.plannedAt);
  const historic = await StopArrival.find({ stopId: stop._id, arrivedAt: { $ne: null } }).sort({ arrivedAt: -1 }).limit(10).select('tripId plannedAt arrivedAt');
  res.json({ stop, live: live.sort((a, b) => a.etaMinutes - b.etaMinutes).slice(0, 2), timetable, historic });
});

router.get('/routes/:routeId/service-status', async (req, res) => res.json(await getRouteServiceStatus(req.params.routeId)));

router.post('/feedback', async (req, res) => {
  const { routeId, stopId, tripId, deviceId, type, message } = req.body;
  if (!routeId || !type) return res.status(422).json({ error: 'routeId and type are required' });
  res.status(201).json(await PassengerFeedback.create({ routeId, stopId, tripId, deviceId, type, message }));
});

module.exports = router;
