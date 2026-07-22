const mongoose = require('mongoose');
const feedbackSchema = new mongoose.Schema({
  deviceId: { type: String, default: null },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  stopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop', default: null },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  type: { type: String, enum: ['bus_did_not_arrive', 'bus_full', 'location_seems_wrong'], required: true },
  message: { type: String, default: '' },
  status: { type: String, enum: ['new', 'reviewed', 'resolved'], default: 'new' },
}, { timestamps: true });
feedbackSchema.index({ routeId: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model('PassengerFeedback', feedbackSchema);
