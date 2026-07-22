const express = require('express');
const jwt = require('jsonwebtoken');
const Trip = require('../models/Trip');
const Stop = require('../models/Stop');
const Route = require('../models/Route');
const RouteConversionRule = require('../models/RouteConversionRule');
const { requireAuth, requireRole } = require('../middleware/auth');
const haversineKm = require('../utils/haversine');
const { osrmDurationMinutes } = require('../utils/osrm');
const { snapToPolyline } = require('../utils/polyline');
const { recordLocation } = require('../services/liveTracking');
const ScheduledTrip = require('../models/ScheduledTrip');
const Bus = require('../models/Bus');

const router = express.Router();

// Injected by server.js so this route can broadcast trip:converted without a
// circular require on the sockets module.
let io = null;
function setIo(socketIoInstance) {
  io = socketIoInstance;
}

router.post('/start', requireAuth, requireRole('driver', 'conductor'), async (req, res) => {
  const { busId, routeId, conductorId, scheduledTripId } = req.body;
  const bus = await Bus.findById(busId);
  if (!bus) return res.status(404).json({ error: 'Bus not found' });
  if (bus.status === 'maintenance' || bus.status === 'unavailable' || bus.readiness !== 'ready') return res.status(409).json({ error: 'Bus is not ready for service' });
  let scheduledTrip = null;
  if (scheduledTripId) {
    scheduledTrip = await ScheduledTrip.findById(scheduledTripId);
    if (!scheduledTrip || String(scheduledTrip.routeId) !== String(routeId) || scheduledTrip.status !== 'scheduled') return res.status(409).json({ error: 'Scheduled departure is not available' });
  }
  const trip = await Trip.create({
    busId,
    routeId,
    driverId: req.user.role === 'driver' ? req.user.id : req.body.driverId,
    conductorId: req.user.role === 'conductor' ? req.user.id : conductorId,
    status: 'active',
    scheduledTripId: scheduledTrip?._id || null,
  });
  await Bus.findByIdAndUpdate(busId, { status: 'active' });
  if (scheduledTrip) await ScheduledTrip.findByIdAndUpdate(scheduledTrip._id, { status: 'active', liveTripId: trip._id, busId, driverId: trip.driverId, conductorId: trip.conductorId });
  res.status(201).json(trip);
});

router.post('/:id/end', requireAuth, requireRole('driver', 'conductor'), async (req, res) => {
  const trip = await Trip.findByIdAndUpdate(
    req.params.id,
    { status: 'completed', endedAt: new Date() },
    { new: true },
  );
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  await Bus.findByIdAndUpdate(trip.busId, { status: 'idle' });
  if (trip.scheduledTripId) await ScheduledTrip.findByIdAndUpdate(trip.scheduledTripId, { status: 'completed' });
  res.json(trip);
});

router.get('/active', async (req, res) => {
  res.json(await Trip.find({ status: { $in: ['active', 'arrived'] } }).select('busId routeId status lastPosition checkpointHistory occupancyBand delayMinutes etaConfidence gpsFreshness'));
});

router.patch('/:id/occupancy', requireAuth, requireRole('conductor', 'driver'), async (req, res) => {
  const passengerCount = Math.max(0, Number(req.body.passengerCount));
  if (!Number.isFinite(passengerCount)) return res.status(422).json({ error: 'passengerCount must be a number' });
  const trip = await Trip.findById(req.params.id).populate('busId');
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (req.user.role === 'conductor' && String(trip.conductorId) !== String(req.user.id)) return res.status(403).json({ error: 'Not assigned to this trip' });
  const capacity = trip.busId?.capacity || 1;
  trip.passengerCount = passengerCount;
  trip.occupancyBand = passengerCount >= capacity * 0.9 ? 'full' : passengerCount >= capacity * 0.55 ? 'moderate' : 'low';
  await trip.save();
  io?.to(`route:${trip.routeId}`).emit('trip:occupancy', { tripId: trip._id, passengerCount, occupancyBand: trip.occupancyBand });
  res.json(trip);
});

// A short-scoped token lets the native Android foreground service upload GPS
// even when the WebView/socket is suspended. It is limited to one trip.
router.post('/:id/location-token', requireAuth, requireRole('driver'), async (req, res) => {
  const trip = await Trip.findById(req.params.id).select('driverId status');
  if (!trip || String(trip.driverId) !== String(req.user.id) || trip.status !== 'active') {
    return res.status(404).json({ error: 'Active driver trip not found' });
  }
  const locationToken = jwt.sign(
    { id: req.user.id, role: req.user.role, tripId: String(trip._id), scope: 'location-upload' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' },
  );
  res.json({ locationToken });
});

// Called directly by the native background-location service. The signed token
// is intentionally limited to this trip and cannot be used for other APIs.
router.post('/:id/location/native', async (req, res) => {
  try {
    const locationToken = req.query.locationToken;
    const claims = jwt.verify(locationToken, process.env.JWT_SECRET);
    if (claims.scope !== 'location-upload' || claims.tripId !== req.params.id || claims.role !== 'driver') {
      return res.status(403).json({ error: 'Invalid location token' });
    }
    const position = req.body;
    const trip = await recordLocation(io, {
      tripId: req.params.id,
      user: claims,
      lat: position.latitude,
      lng: position.longitude,
      speed: (position.speed || 0) * 3.6,
      heading: position.bearing || 0,
      capturedAt: position.time,
    });
    if (!trip) {
      console.warn(`[gps] native rejected trip=${req.params.id}`);
      return res.status(404).json({ error: 'Active driver trip not found' });
    }
    console.log(`[gps] native accepted trip=${req.params.id}`);
    res.status(204).send();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

router.get('/:id/eta', async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const stop = await Stop.findById(req.query.stopId);
  if (!stop) return res.status(404).json({ error: 'Stop not found' });

  if (!trip.lastPosition?.location) {
    return res.status(422).json({ error: 'No live position yet for this trip' });
  }

  const route = await Route.findById(trip.routeId).select('polyline');
  const busCoords = route?.polyline?.coordinates?.length
    ? snapToPolyline(trip.lastPosition.location.coordinates, route.polyline.coordinates)
    : trip.lastPosition.location.coordinates;

  const osrmMinutes = await osrmDurationMinutes(busCoords, stop.location.coordinates);
  if (osrmMinutes !== null) {
    return res.json({ etaMinutes: Math.round(osrmMinutes), source: 'osrm' });
  }

  const distanceKm = haversineKm(busCoords, stop.location.coordinates);
  const etaMinutes = (distanceKm / Math.max(trip.lastPosition.speedKmph || 0, 8)) * 60;
  res.json({ distanceKm, etaMinutes: Math.round(etaMinutes), source: 'haversine' });
});

// Section 4.5: driver/conductor confirms the auto-suggested (or manually
// overridden) next route once the bus is flagged "arrived" at a terminus.
router.post('/:id/confirm-conversion', requireAuth, requireRole('driver', 'conductor'), async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.status !== 'arrived') return res.status(409).json({ error: 'Trip is not awaiting conversion' });

  let toRouteId = req.body.toRouteId;
  if (!toRouteId) {
    const rule = await RouteConversionRule.findOne({ fromRouteId: trip.routeId });
    toRouteId = rule?.toRouteId;
  }
  if (!toRouteId) return res.status(422).json({ error: 'No conversion rule and no toRouteId override provided' });

  trip.status = 'completed';
  trip.endedAt = new Date();
  await trip.save();

  const newTrip = await Trip.create({
    busId: trip.busId,
    routeId: toRouteId,
    driverId: trip.driverId,
    conductorId: trip.conductorId,
    status: 'active',
  });
  await Bus.findByIdAndUpdate(trip.busId, { status: 'active' });

  io?.to(`route:${trip.routeId}`).emit('trip:converted', { oldTripId: trip._id, newTripId: newTrip._id, toRouteId });
  io?.to(`route:${toRouteId}`).emit('trip:converted', { oldTripId: trip._id, newTripId: newTrip._id, toRouteId });

  res.status(201).json(newTrip);
});

module.exports = { router, setIo };
