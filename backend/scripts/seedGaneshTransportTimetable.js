// Imports the timetable supplied by Ganesh Transport (effective 1 July 2025)
// for the existing Regency Anantam -> Dombivli route. It creates two weeks of
// dispatchable ScheduledTrips; rerun it at the end of the horizon or automate
// it with the same helper in production.
require('dotenv').config();
const connectDB = require('../config/db');
const Route = require('../models/Route');
const Stop = require('../models/Stop');
const Schedule = require('../models/Schedule');
const ScheduledTrip = require('../models/ScheduledTrip');

const WEEKDAY = ['05:30', '06:00', '06:15', '06:30', '06:40', '06:50', '07:00', '07:10', '07:20', '07:30', '07:40', '07:50', '08:00', '08:10', '08:20', '08:30', '08:40', '08:50', '09:00', '09:10', '09:20', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '12:00', '12:30', '13:00', '14:00', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:15', '18:30', '18:45', '19:00', '19:10', '19:20', '19:30', '19:40', '19:50', '20:00', '20:10', '20:20', '20:30', '20:40', '20:50', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:15'];
const SATURDAY = ['05:30', '06:00', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '11:00', '11:15', '11:30', '12:00', '12:30', '13:00', '14:00', '15:00', '15:30', '16:00', '16:30', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '23:15'];
const SUNDAY = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];

function localDate(offset) {
  const date = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}
function departureAt(date, time) { return new Date(`${date}T${time}:00+05:30`); }

async function seed() {
  await connectDB();
  const route = await Route.findOne({ active: true }).sort({ createdAt: 1 });
  if (!route) throw new Error('Seed a route before importing the timetable');
  const stops = await Stop.find({ routeId: route._id }).sort({ sequenceOrder: 1 });
  if (!stops.length) throw new Error('Route needs stops before importing the timetable');
  const schedule = await Schedule.findOneAndUpdate(
    { routeId: route._id, name: 'Ganesh Transport published timetable' },
    { routeId: route._id, name: 'Ganesh Transport published timetable', operatingDays: [0, 1, 2, 3, 4, 5, 6], timezone: 'Asia/Kolkata', active: true },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  let created = 0;
  let alreadyPresent = 0;
  for (let offset = 0; offset < 14; offset += 1) {
    const operatingDate = localDate(offset);
    const weekday = new Date(`${operatingDate}T12:00:00+05:30`).getDay();
    const departures = weekday === 0 ? SUNDAY : weekday === 6 ? SATURDAY : WEEKDAY;
    for (const time of departures) {
      const plannedDepartureAt = departureAt(operatingDate, time);
      const expectedStopTimes = stops.map((stop, index) => ({ stopId: stop._id, plannedAt: new Date(plannedDepartureAt.getTime() + index * 90_000) }));
      const result = await ScheduledTrip.updateOne(
        { routeId: route._id, operatingDate, plannedDepartureAt },
        { $setOnInsert: { scheduleId: schedule._id, routeId: route._id, operatingDate, plannedDepartureAt, expectedStopTimes, status: 'scheduled' } },
        { upsert: true },
      );
      created += result.upsertedCount;
      alreadyPresent += result.matchedCount;
    }
  }
  console.log(`Ganesh Transport timetable ready for ${route.name}: ${created} departures added, ${alreadyPresent} already present.`);
  await require('mongoose').disconnect();
}

seed().catch((error) => { console.error(error); process.exit(1); });
