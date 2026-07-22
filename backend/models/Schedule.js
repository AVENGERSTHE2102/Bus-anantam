const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  name: { type: String, required: true },
  operatingDays: [{ type: Number, min: 0, max: 6 }], // Sunday = 0
  timezone: { type: String, default: 'Asia/Kolkata' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

scheduleSchema.index({ routeId: 1, active: 1 });
module.exports = mongoose.model('Schedule', scheduleSchema);
