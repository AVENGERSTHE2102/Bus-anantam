const express = require('express');
const Favorite = require('../models/Favorite');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, requireRole('passenger'), async (req, res) => {
  res.json(await Favorite.find({ userId: req.user.id }));
});

router.post('/', requireAuth, requireRole('passenger'), async (req, res) => {
  const { stopId, routeId } = req.body;
  try {
    const favorite = await Favorite.create({ userId: req.user.id, stopId, routeId });
    res.status(201).json(favorite);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Already favorited' });
    throw err;
  }
});

router.delete('/:id', requireAuth, requireRole('passenger'), async (req, res) => {
  await Favorite.deleteOne({ _id: req.params.id, userId: req.user.id });
  res.status(204).send();
});

module.exports = router;
