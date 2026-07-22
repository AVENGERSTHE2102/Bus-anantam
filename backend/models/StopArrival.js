const mongoose = require('mongoose');
const stopArrivalSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  scheduledTripId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledTrip', default: null },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  stopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop', required: true },
  plannedAt: { type: Date, default: null },
  estimatedAt: { type: Date, default: null },
  arrivedAt: { type: Date, default: null },
  etaConfidence: { type: String, enum: ['high', 'medium', 'limited'], default: 'limited' },
}, { timestamps: true });
stopArrivalSchema.index({ stopId: 1, estimatedAt: 1 });
stopArrivalSchema.index({ tripId: 1, stopId: 1 }, { unique: true });
module.exports = mongoose.model('StopArrival', stopArrivalSchema);
