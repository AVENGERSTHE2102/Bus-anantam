const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 12 * 60 * 60 * 1000,
};

router.post('/register', async (req, res) => {
  const { name, phone, role, password } = req.body;
  if (!name || !phone || !role || !password) {
    return res.status(400).json({ error: 'name, phone, role, password are required' });
  }
  if (!['admin', 'driver', 'conductor', 'passenger'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ name, phone, role, passwordHash });
    res.status(201).json({ id: user._id, name: user.name, role: user.role });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Phone already registered' });
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  const user = await User.findOne({ phone });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie('token', token, COOKIE_OPTIONS);
  // A Capacitor WebView and a remote API are cross-origin, so a Strict cookie
  // cannot carry its session. Return a token only to the packaged native app;
  // it is stored with Capacitor Preferences and sent as a Bearer token.
  res.json({
    user: { id: user._id, name: user.name, role: user.role },
    ...(req.get('X-BusTracker-Client') === 'capacitor' ? { accessToken: token } : {}),
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.status(204).send();
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findOne({ _id: req.user.id });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: { id: user._id, name: user.name, role: user.role } });
});

module.exports = router;
