const jwt = require('jsonwebtoken');
const { parseCookies } = require('../utils/cookies');

function requireAuth(req, res, next) {
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
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireRole };
