const runStallDetection = require('./stallDetection');
const runConversionGraceWindow = require('./conversionGraceWindow');
const runArrivalNotifications = require('./arrivalNotifications');
const { JOB_INTERVAL_MS } = require('../config/constants');
const { LIVE_FLEET_ROOM, emitLiveFleetSnapshot } = require('../services/liveFleet');

function startJobs(io) {
  setInterval(() => {
    runStallDetection(io).catch((err) => console.error('[jobs] stallDetection failed:', err));
    runConversionGraceWindow(io).catch((err) => console.error('[jobs] conversionGraceWindow failed:', err));
    runArrivalNotifications().catch((err) => console.error('[jobs] arrivalNotifications failed:', err));
    // Reconcile existing passenger maps as GPS records age out. This emits a
    // tiny full fleet state (normally only a few buses), not synthetic motion.
    emitLiveFleetSnapshot(io.to(LIVE_FLEET_ROOM)).catch((err) => console.error('[jobs] liveFleet refresh failed:', err));
  }, JOB_INTERVAL_MS);
}

module.exports = startJobs;
