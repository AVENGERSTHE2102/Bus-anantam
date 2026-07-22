const mongoose = require('mongoose');
const geoPointSchema = require('./geoPoint');

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  startLocation: { type: geoPointSchema, required: true },
  endLocation: { type: geoPointSchema, required: true },
  // Phase 2: used by OSRM/map-matching for road-network ETA
  polyline: {
    type: { type: String, enum: ['LineString'], default: 'LineString' },
    coordinates: { type: [[Number]] },
  },
  active: { type: Boolean, default: true },
});

routeSchema.index({ endLocation: '2dsphere' });

module.exports = mongoose.model('Route', routeSchema);
