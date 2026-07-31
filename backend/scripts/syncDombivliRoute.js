// Applies operator-verified stop corrections in place, preserving stop ids
// and timetable references, then rebuilds only this route's road geometry.
require('dotenv').config();
const connectDB = require('../config/db');
const Route = require('../models/Route');
const Stop = require('../models/Stop');

const STOP_UPDATES = [
  { previousName: 'RK Bazar (towards station)', name: 'RK Bazar (towards station)', coordinates: [73.11598009762258, 19.204721233757567] },
  { previousName: 'RR Hospital', name: 'RR Hospital', coordinates: [73.10762118754185, 19.21164957155188] },
  { previousName: 'Pendharkar College', name: 'Pendharkar College', coordinates: [73.10546373819447, 19.21328574693324] },
  { previousName: 'Gharda Circle', name: 'Gharda Circle', coordinates: [73.10249540195609, 19.21418908570801] },
  { previousName: 'Manjunath School', name: 'Manjunath Vidyalaya', coordinates: [73.09569366695122, 19.21550547824151] },
];

async function roadGeometry(coordinates) {
  if (!process.env.OSRM_BASE_URL) throw new Error('OSRM_BASE_URL is required to regenerate route geometry');
  const waypoints = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const response = await fetch(`${process.env.OSRM_BASE_URL}/route/v1/driving/${waypoints}?overview=full&geometries=geojson`);
  if (!response.ok) throw new Error(`OSRM route request failed: ${response.status}`);
  const geometry = (await response.json())?.routes?.[0]?.geometry?.coordinates;
  if (!geometry?.length) throw new Error('OSRM returned no route geometry');
  return geometry;
}

async function run() {
  await connectDB();
  const route = await Route.findOne({ name: 'Dombivli Test Route' });
  if (!route) throw new Error('Dombivli Test Route was not found');
  const stops = await Stop.find({ routeId: route._id }).sort('sequenceOrder');
  const updatesByName = new Map(STOP_UPDATES.map((update) => [update.previousName, update]));
  const missing = STOP_UPDATES.filter((update) => !stops.some((stop) => stop.name === update.previousName));
  if (missing.length) throw new Error(`Stops not found: ${missing.map((update) => update.previousName).join(', ')}`);
  // Validate OSRM first, so a temporary routing outage cannot leave a partially
  // updated route in MongoDB.
  const geometry = await roadGeometry(stops.map((stop) => updatesByName.get(stop.name)?.coordinates || stop.location.coordinates));
  for (const stop of stops) {
    const update = updatesByName.get(stop.name);
    if (!update) continue;
    stop.name = update.name;
    stop.location = { type: 'Point', coordinates: update.coordinates };
    await stop.save();
    console.log(`Updated ${update.name}: ${update.coordinates[1]}, ${update.coordinates[0]}`);
  }
  route.startLocation = { type: 'Point', coordinates: stops[0].location.coordinates };
  route.endLocation = { type: 'Point', coordinates: stops[stops.length - 1].location.coordinates };
  route.polyline = { type: 'LineString', coordinates: geometry };
  await route.save();
  console.log(`Updated ${route.name} road geometry with ${route.polyline.coordinates.length} points.`);
  await require('mongoose').disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await require('mongoose').disconnect();
  process.exit(1);
});
