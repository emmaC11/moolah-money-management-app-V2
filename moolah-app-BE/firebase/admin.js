// firebase/admin.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  } else {
    // Uses Application Default Credentials (ADC) if available
    admin.initializeApp();
  }
}

module.exports = {
  admin,
  db: admin.firestore(),
  auth: admin.auth(),
};