const express = require('express');
const Remark = require('../models/Remark');
const Trip = require('../models/Trip');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Injected by server.js so this route can broadcast without a circular require on sockets.
let io = null;
function setIo(socketIoInstance) {
  io = socketIoInstance;
}

router.post('/trips/:id/remarks', requireAuth, requireRole('driver', 'conductor'), async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  const { tag, message } = req.body;
  const remark = await Remark.create({
    tripId: trip._id,
    source: req.user.role,
    tag,
    message,
    location: trip.lastPosition?.location,
  });

  io?.to(`route:${trip.routeId}`).emit('remark:new', remark);
  io?.to('admin').emit('remark:new', remark);
  res.status(201).json(remark);
});

// Passenger view: remarks for a single route, most recent first.
router.get('/remarks', async (req, res) => {
  const { routeId } = req.query;
  if (!routeId) return res.status(400).json({ error: 'routeId is required' });

  const trips = await Trip.find({ routeId }).select('_id');
  const remarks = await Remark.find({ tripId: { $in: trips.map((t) => t._id) } })
    .sort('-createdAt')
    .limit(50);
  res.json(remarks);
});

router.get('/admin/remarks', requireAuth, requireRole('admin'), async (req, res) => {
  res.json(await Remark.find().sort('-createdAt').limit(200));
});

module.exports = { router, setIo };
