const mongoose = require('mongoose');
const geoPointSchema = require('./geoPoint');

const stopSchema = new mongoose.Schema({
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  name: { type: String, required: true },
  location: { type: geoPointSchema, required: true },
  sequenceOrder: { type: Number, required: true },
});

stopSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Stop', stopSchema);
