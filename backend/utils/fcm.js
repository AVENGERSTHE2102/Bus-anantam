// Firebase Cloud Messaging (Section 5). No-ops with a console warning when no
// service account is configured, so the rest of the app works without a live
// Firebase project during development.
const admin = require('firebase-admin');

let app = null;

function getApp() {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  app = admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return app;
}

async function sendPush(tokens, title, body, data = {}) {
  const validTokens = tokens.filter(Boolean);
  if (!validTokens.length) return;

  const firebaseApp = getApp();
  if (!firebaseApp) {
    console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT_JSON not set, skipping push:', title);
    return;
  }

  await admin.messaging(firebaseApp).sendEachForMulticast({
    tokens: validTokens,
    notification: { title, body },
    data,
  });
}

module.exports = { sendPush };
