const jwt = require('jsonwebtoken');
const { parseCookies } = require('../utils/cookies');
const User = require('../models/User');

function testAuthEnabled() {
  return process.env.DISABLE_AUTH_FOR_TESTING === 'true';
}

async function getTestingUser(role = 'driver') {
  const safeRole = ['admin', 'driver', 'conductor', 'passenger'].includes(role) ? role : 'driver';
  const user = await User.findOne({ phone: `demo-${safeRole}` });
  // The normal app creates these accounts automatically. The fallback keeps a
  // clean test database usable before that bootstrap has run.
  return { id: user?._id || `testing-${safeRole}`, role: user?.role || safeRole };
}

async function requireAuth(req, res, next) {
  if (testAuthEnabled()) {
    req.user = await getTestingUser(req.get('X-BusTracker-Test-Role') || 'driver');
    console.warn(`[auth] TEST BYPASS ${req.method} ${req.originalUrl} as=${req.user.role}`);
    return next();
  }
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : parseCookies(req.headers.cookie).token;

  if (!token) {
    console.warn(`[auth] missing token ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    console.warn(`[auth] invalid or expired token ${req.method} ${req.originalUrl}`);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (testAuthEnabled()) return next();
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireRole, testAuthEnabled, getTestingUser };
