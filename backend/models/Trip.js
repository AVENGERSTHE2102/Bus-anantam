const mongoose = require('mongoose');
const geoPointSchema = require('./geoPoint');

const tripSchema = new mongoose.Schema({
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  // String, not ObjectId: User now lives in SQLite with UUID ids, not Mongo.
  driverId: { type: String, required: true },
  conductorId: { type: String },
  scheduledTripId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledTrip', default: null },
  status: { type: String, default: 'active', enum: ['active', 'arrived', 'completed', 'cancelled'] },
  lastPosition: {
    location: { type: geoPointSchema },
    speedKmph: { type: Number },
    heading: { type: Number },
    recordedAt: { type: Date },
  },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  // Phase 3: stall detection + terminus conversion bookkeeping
  lowSpeedSince: { type: Date, default: null },
  lastStallRemarkAt: { type: Date, default: null },
  arrivedAt: { type: Date, default: null },
  // Phase 2: track which favorited stops have already been push-notified this trip
  notifiedStopIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stop' }],
  checkpointHistory: [{
    stopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop' },
    arrivedAt: { type: Date, default: Date.now },
    plannedAt: { type: Date, default: null },
  }],
  occupancyBand: { type: String, enum: ['low', 'moderate', 'full'], default: 'low' },
  passengerCount: { type: Number, default: 0, min: 0 },
  gpsFreshness: { type: String, enum: ['fresh', 'aging', 'stale', 'unknown'], default: 'unknown' },
  delayMinutes: { type: Number, default: 0 },
  delayReason: { type: String, default: null },
  cancellationReason: { type: String, default: null },
  etaConfidence: { type: String, enum: ['high', 'medium', 'limited'], default: 'limited' },
});

tripSchema.index({ 'lastPosition.location': '2dsphere' });

module.exports = mongoose.model('Trip', tripSchema);
