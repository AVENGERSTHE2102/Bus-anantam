// Minimal Mongo-query-shape shim over node:sqlite, covering only the
// $in/$nin/$ne + exact-match shapes actually used by models/User.js and
// models/Favorite.js — not a general query engine.
function matches(row, query) {
  return Object.entries(query).every(([key, cond]) => {
    const field = key === '_id' ? 'id' : key;
    const value = row[field];
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('$in' in cond) return cond.$in.map(String).includes(String(value));
      if ('$nin' in cond) return !cond.$nin.map(String).includes(String(value));
      if ('$ne' in cond) return cond.$ne === null ? value != null : String(value) !== String(cond.$ne);
      return false;
    }
    return String(value) === String(cond);
  });
}

// Supports both `await Model.find(q)` and `await Model.find(q).distinct(field)`.
function findResult(rows) {
  return {
    then(resolve, reject) {
      Promise.resolve(rows).then(resolve, reject);
    },
    distinct(field) {
      return Promise.resolve([...new Set(rows.map((r) => r[field]).filter((v) => v != null))]);
    },
  };
}

module.exports = { matches, findResult };
