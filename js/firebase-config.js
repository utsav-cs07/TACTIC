/* ═══════════════════════════════════════════
   FIREBASE-CONFIG.JS — NEXUS AI
   Credentials configured ✓
═══════════════════════════════════════════ */

// ✅ Firebase is dynamically enabled only if keys exist
const FIREBASE_ENABLED = !!(window.ENV && window.ENV.FIREBASE_API_KEY);

// ✅ Your Firebase project credentials
const FIREBASE_CONFIG = {
  apiKey:            window.ENV?.FIREBASE_API_KEY,
  authDomain:        window.ENV?.FIREBASE_AUTH_DOMAIN,
  projectId:         window.ENV?.FIREBASE_PROJECT_ID,
  storageBucket:     window.ENV?.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.ENV?.FIREBASE_MESSAGING_SENDER_ID,
  appId:             window.ENV?.FIREBASE_APP_ID,
  measurementId:     window.ENV?.FIREBASE_MEASUREMENT_ID,
};

/*
  ⚠️  DO NOT ADD these lines — they are for npm/module mode only
  and will break the CDN version this app uses:

  ✗  const app = initializeApp(firebaseConfig);   ← WRONG for CDN
  ✗  const analytics = getAnalytics(app);          ← WRONG for CDN

  Firebase is initialized automatically in app.js via:
  ✓  firebase.initializeApp(FIREBASE_CONFIG);       ← CDN compat way
*/
