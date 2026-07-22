require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const initSockets = require('./sockets');
const startJobs = require('./jobs');
const authRoutes = require('./routes/auth');
const routeRoutes = require('./routes/routes');
const tripRoutes = require('./routes/trips');
const remarkRoutes = require('./routes/remarks');
const favoriteRoutes = require('./routes/favorites');
const adminRoutes = require('./routes/admin');
const busRoutes = require('./routes/buses');
const publicRoutes = require('./routes/public');

const app = express();
// Request-level operational diagnostics for Render logs. Do not log headers,
// request bodies, tokens, or exact location coordinates here.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`[http] ${req.method} ${req.originalUrl} → ${res.statusCode} ${Date.now() - startedAt}ms origin=${req.get('origin') || '-'}`);
  });
  next();
});
const allowedOrigins = new Set([
  ...(process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((origin) => origin.trim()),
  'http://localhost',
  'https://localhost',
]);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '128kb' }));

// A dependency-free guard suitable for a small public pilot. It prevents a
// single client from exhausting Mongo/OSRM while keeping normal passenger map
// refreshes well below the 120 requests/minute window.
const publicWindows = new Map();
app.use('/public', (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = publicWindows.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt >= 60_000) { bucket.startedAt = now; bucket.count = 0; }
  bucket.count += 1;
  publicWindows.set(key, bucket);
  if (bucket.count > 120) return res.status(429).json({ error: 'Too many requests; please retry shortly' });
  next();
});

app.use('/auth', authRoutes);
app.use('/buses', busRoutes);
app.use('/routes', routeRoutes);
app.use('/public', publicRoutes);
app.use('/trips', tripRoutes.router);
app.use('/', remarkRoutes.router);
app.use('/favorites', favoriteRoutes);
app.use('/admin', adminRoutes.router);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});
initSockets(io);
tripRoutes.setIo(io);
remarkRoutes.setIo(io);
adminRoutes.setIo(io);

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`BusTracker backend listening on :${PORT}`));
  startJobs(io);
});
