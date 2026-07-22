const mongoose = require('mongoose');
const crewAssignmentSchema = new mongoose.Schema({
  scheduledTripId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledTrip', required: true, unique: true },
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  driverId: { type: String, default: null },
  conductorId: { type: String, default: null },
  assignedBy: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('CrewAssignment', crewAssignmentSchema);
