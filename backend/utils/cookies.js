// Minimal manual cookie-header parser (avoids adding cookie-parser as a
// dependency for the one thing we need: reading the `token` cookie).
function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const key = pair.slice(0, idx).trim();
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    acc[key] = value;
    return acc;
  }, {});
}

module.exports = { parseCookies };
