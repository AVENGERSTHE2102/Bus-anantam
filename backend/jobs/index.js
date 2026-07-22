const runStallDetection = require('./stallDetection');
const runConversionGraceWindow = require('./conversionGraceWindow');
const runArrivalNotifications = require('./arrivalNotifications');
const { JOB_INTERVAL_MS } = require('../config/constants');

function startJobs(io) {
  setInterval(() => {
    runStallDetection(io).catch((err) => console.error('[jobs] stallDetection failed:', err));
    runConversionGraceWindow(io).catch((err) => console.error('[jobs] conversionGraceWindow failed:', err));
    runArrivalNotifications().catch((err) => console.error('[jobs] arrivalNotifications failed:', err));
  }, JOB_INTERVAL_MS);
}

module.exports = startJobs;
