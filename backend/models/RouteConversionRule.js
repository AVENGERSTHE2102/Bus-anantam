const mongoose = require('mongoose');

const routeConversionRuleSchema = new mongoose.Schema({
  fromRouteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  toRouteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  timeWindow: { type: String, default: null }, // e.g. 'weekday_evening', null = always
});

module.exports = mongoose.model('RouteConversionRule', routeConversionRuleSchema);
