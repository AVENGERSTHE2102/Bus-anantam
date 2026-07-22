const crypto = require('crypto');
const db = require('../config/sqlite');
const { matches, findResult } = require('../config/sqliteQuery');

const insertStmt = db.prepare('INSERT INTO favorites (id, userId, stopId, routeId) VALUES (?, ?, ?, ?)');
const allStmt = db.prepare('SELECT * FROM favorites');
const deleteStmt = db.prepare('DELETE FROM favorites WHERE id = ? AND userId = ?');

function toFavorite(row) {
  if (!row) return null;
  return { _id: row.id, userId: row.userId, stopId: row.stopId, routeId: row.routeId };
}

async function create({ userId, stopId, routeId }) {
  const id = crypto.randomUUID();
  try {
    insertStmt.run(id, userId, stopId, routeId);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      const dup = new Error('Already favorited');
      dup.code = 11000;
      throw dup;
    }
    throw err;
  }
  return toFavorite({ id, userId, stopId, routeId });
}

function find(query = {}) {
  const rows = allStmt.all().filter((r) => matches(r, query)).map(toFavorite);
  return findResult(rows);
}

async function deleteOne({ _id, userId }) {
  deleteStmt.run(_id, userId);
}

// Only supports the exact pipeline shape used in routes/admin.js analytics:
// group by a field with a $sum count, optional $sort, optional $limit.
async function aggregate(pipeline) {
  const rows = allStmt.all().map(toFavorite);
  const groupStage = pipeline.find((s) => s.$group);
  let result = rows;

  if (groupStage) {
    const idField = groupStage.$group._id.replace('$', '');
    const countKey = Object.keys(groupStage.$group).find((k) => k !== '_id');
    const groups = new Map();
    for (const row of rows) {
      const key = row[idField];
      if (!groups.has(key)) groups.set(key, { _id: key, [countKey]: 0 });
      groups.get(key)[countKey] += 1;
    }
    result = [...groups.values()];
  }

  const sortStage = pipeline.find((s) => s.$sort);
  if (sortStage) {
    const [[field, dir]] = Object.entries(sortStage.$sort);
    result = [...result].sort((a, b) => (dir === -1 ? b[field] - a[field] : a[field] - b[field]));
  }

  const limitStage = pipeline.find((s) => s.$limit);
  if (limitStage) result = result.slice(0, limitStage.$limit);

  return result;
}

module.exports = { create, find, deleteOne, aggregate };
