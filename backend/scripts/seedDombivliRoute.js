// One-off seed script for the Dombivli test route: Anantam Exit -> Sangeeta
// Cycle Mart (Phadke Road), 11 checkpoints supplied by the operator.
require('dotenv').config();
const connectDB = require('../config/db');
const Route = require('../models/Route');
const Stop = require('../models/Stop');

const STOPS_IN_ORDER = [
  { name: 'Anantam Exit', coordinates: [73.11745213754632, 19.203479081863996] },
  { name: 'RK Bazar (towards station)', coordinates: [73.11602487668017, 19.204730901705076] },
  { name: 'Anantam Entry Gate', coordinates: [73.11083858533283, 19.208693549498975] },
  { name: 'RR Hospital', coordinates: [73.10753399824372, 19.211795372941065] },
  { name: 'Pendharkar College', coordinates: [73.10556262129934, 19.21325974769244] },
  { name: 'Gharda Circle', coordinates: [73.10254534683249, 19.214241663551427] },
  { name: 'Shelar Naka', coordinates: [73.09902142027917, 19.216069119469804] },
  { name: 'Manjunath School', coordinates: [73.09662399484058, 19.21539405416933] },
  { name: 'Tilak Chowk', coordinates: [73.09448698567374, 19.215350105562113] },
  { name: 'Sarvesh Hall', coordinates: [73.09191608150262, 19.216650277582094] },
  { name: 'Sangeeta Cycle Mart, Phadke Road', coordinates: [73.09090516816048, 19.21964046867201] },
];

async function seed() {
  await connectDB();

  const missing = STOPS_IN_ORDER.filter((s) => s.coordinates.includes(null));
  if (missing.length) {
    console.error('Fill in coordinates for:', missing.map((s) => s.name).join(', '));
    process.exit(1);
  }

  const route = await Route.create({
    name: 'Dombivli Test Route',
    startLocation: { type: 'Point', coordinates: STOPS_IN_ORDER[0].coordinates },
    endLocation: { type: 'Point', coordinates: STOPS_IN_ORDER[STOPS_IN_ORDER.length - 1].coordinates },
    polyline: { type: 'LineString', coordinates: STOPS_IN_ORDER.map((s) => s.coordinates) },
  });

  for (const [index, stop] of STOPS_IN_ORDER.entries()) {
    await Stop.create({
      routeId: route._id,
      name: stop.name,
      location: { type: 'Point', coordinates: stop.coordinates },
      sequenceOrder: index,
    });
  }

  console.log(`Seeded route "${route.name}" (${route._id}) with ${STOPS_IN_ORDER.length} stops`);
  process.exit(0);
}

seed();
