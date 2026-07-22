const mongoose = require('mongoose');

const scheduledTripSchema = new mongoose.Schema({
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  operatingDate: { type: String, required: true }, // local YYYY-MM-DD
  plannedDepartureAt: { type: Date, required: true },
  expectedStopTimes: [{ stopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop' }, plannedAt: Date }],
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', default: null },
  driverId: { type: String, default: null },
  conductorId: { type: String, default: null },
  status: { type: String, enum: ['scheduled', 'active', 'arrived', 'completed', 'cancelled', 'missed'], default: 'scheduled' },
  liveTripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  cancellationReason: { type: String, default: null },
}, { timestamps: true });

scheduledTripSchema.index({ routeId: 1, operatingDate: 1, plannedDepartureAt: 1 });
module.exports = mongoose.model('ScheduledTrip', scheduledTripSchema);
