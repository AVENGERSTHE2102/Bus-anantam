const mongoose = require('mongoose');
const geoPointSchema = require('./geoPoint');

const remarkSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  source: { type: String, required: true, enum: ['driver', 'conductor', 'system'] },
  tag: { type: String, enum: ['traffic', 'accident', 'roadblock', 'breakdown', 'other'] },
  message: { type: String },
  location: { type: geoPointSchema },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

module.exports = mongoose.model('Remark', remarkSchema);
