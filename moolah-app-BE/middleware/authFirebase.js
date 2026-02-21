// middleware/authFirebase.js
const admin = require('../firebase/admin');

module.exports = async function authFirebase(req, res, next) {
  try {
    const authz = req.headers.authorization || '';
    const m = authz.match(/^Bearer (.+)$/i);
    if (!m) return res.status(401).json({ success: false, message: 'Missing Authorization' });

    const token = m[1];
    try {
      const decoded = await admin.auth().verifyIdToken(token, true);
      req.user = decoded;
      return next();
    } catch (err) {
      console.error('[VerifyIdToken] FAILED', { code: err?.code, message: err?.message });
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  } catch (outer) {
    console.error('[VerifyIdToken] Unexpected error', outer);
    return res.status(500).json({ success: false, message: 'Auth error' });
  }
};