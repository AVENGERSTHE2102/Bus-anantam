const crypto = require('crypto');
const db = require('../config/sqlite');
const { matches, findResult } = require('../config/sqliteQuery');

const insertStmt = db.prepare(
  'INSERT INTO users (id, name, phone, role, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
);
const findByPhoneStmt = db.prepare('SELECT * FROM users WHERE phone = ?');
const findByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const allStmt = db.prepare('SELECT * FROM users');
const updateFcmTokenStmt = db.prepare('UPDATE users SET fcmToken = ? WHERE id = ?');

function toUser(row) {
  if (!row) return null;
  return { _id: row.id, name: row.name, phone: row.phone, role: row.role, passwordHash: row.passwordHash, fcmToken: row.fcmToken };
}

async function create({ name, phone, role, passwordHash }) {
  const id = crypto.randomUUID();
  try {
    insertStmt.run(id, name, phone, role, passwordHash, new Date().toISOString());
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      const dup = new Error('Phone already registered');
      dup.code = 11000;
      throw dup;
    }
    throw err;
  }
  return toUser(findByIdStmt.get(id));
}

async function findOne({ phone, _id }) {
  if (phone) return toUser(findByPhoneStmt.get(phone));
  if (_id) return toUser(findByIdStmt.get(_id));
  return null;
}

function find(query = {}) {
  const rows = allStmt.all().filter((r) => matches(r, query)).map(toUser);
  return findResult(rows);
}

async function setFcmToken(id, fcmToken) {
  updateFcmTokenStmt.run(fcmToken, id);
}

module.exports = { create, findOne, find, setFcmToken };
