const mongoose = require('mongoose');
const vehicleStatusSchema = new mongoose.Schema({
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true, unique: true },
  state: { type: String, enum: ['ready', 'inspection_due', 'maintenance', 'unavailable'], default: 'ready' },
  checklist: [{ label: String, complete: Boolean }],
  note: { type: String, default: null },
  updatedBy: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('VehicleStatus', vehicleStatusSchema);
