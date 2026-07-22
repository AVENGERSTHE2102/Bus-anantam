// One-off: extend the Dombivli route's road polyline so it starts at the
// Regency Anantam Build 19 origin landmark and joins into the existing route
// via real roads, instead of the route line starting bare at Anantam Exit.
require('dotenv').config();
const connectDB = require('../config/db');
const Route = require('../models/Route');
const Stop = require('../models/Stop');

const BUILD_19_COORDS = [73.11962915303403, 19.20226827682613]; // [lng, lat]

async function fetchRoadGeometry(coordinates) {
  const baseUrl = process.env.OSRM_BASE_URL;
  const waypoints = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `${baseUrl}/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`);
  const data = await res.json();
  const geometry = data?.routes?.[0]?.geometry?.coordinates;
  if (!geometry) throw new Error('OSRM returned no route geometry');
  return geometry;
}

async function run() {
  await connectDB();

  const route = await Route.findOne({ name: 'Dombivli Test Route' });
  if (!route) throw new Error('Dombivli Test Route not found');

  const stops = await Stop.find({ routeId: route._id }).sort('sequenceOrder');
  const geometry = await fetchRoadGeometry([BUILD_19_COORDS, ...stops.map((s) => s.location.coordinates)]);

  route.polyline = { type: 'LineString', coordinates: geometry };
  await route.save();
  console.log(`Joined Build 19 into "${route.name}": ${geometry.length} road-geometry points`);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
