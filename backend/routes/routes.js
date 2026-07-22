const express = require('express');
const Route = require('../models/Route');
const Stop = require('../models/Stop');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  res.json(await Route.find({ active: true }));
});

router.get('/:id/stops', async (req, res) => {
  res.json(await Stop.find({ routeId: req.params.id }).sort('sequenceOrder'));
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, startLocation, endLocation, polyline } = req.body;
  const route = await Route.create({ name, startLocation, endLocation, polyline });
  res.status(201).json(route);
});

router.post('/:id/stops', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, location, sequenceOrder } = req.body;
  const stop = await Stop.create({ routeId: req.params.id, name, location, sequenceOrder });
  res.status(201).json(stop);
});

module.exports = router;
