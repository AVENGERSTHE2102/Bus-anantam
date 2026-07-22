const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, unique: true },
  capacity: { type: Number },
  status: { type: String, default: 'idle', enum: ['idle', 'active', 'maintenance', 'unavailable'] },
  readiness: { type: String, default: 'ready', enum: ['ready', 'inspection_due', 'unavailable'] },
  maintenanceNote: { type: String, default: null },
  lastChecklistAt: { type: Date, default: null },
});

module.exports = mongoose.model('Bus', busSchema);
