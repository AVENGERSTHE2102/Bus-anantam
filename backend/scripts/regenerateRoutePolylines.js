// One-off: replace each route's straight stop-to-stop polyline with the real
// road-following geometry from OSRM, so the map draws actual roads instead
// of straight lines between stops (and bus-snapping/ETA get more accurate).
require('dotenv').config();
const connectDB = require('../config/db');
const Route = require('../models/Route');
const Stop = require('../models/Stop');

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

  const routes = await Route.find({});
  for (const route of routes) {
    const stops = await Stop.find({ routeId: route._id }).sort('sequenceOrder');
    if (stops.length < 2) continue;

    const geometry = await fetchRoadGeometry(stops.map((s) => s.location.coordinates));
    route.polyline = { type: 'LineString', coordinates: geometry };
    await route.save();
    console.log(`Updated "${route.name}": ${geometry.length} road-geometry points (was ${stops.length} straight-line stops)`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
