// middleware/authFirebase.js
const { auth } = require('../firebase/admin');

function decodeJwtPayload(token) {
  // JWT format: header.payload.signature
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Invalid token format');

  const payload = parts[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json);
}

module.exports = async function authFirebase(req, res, next) {
  const authz = req.headers.authorization || '';
  const match = authz.match(/^Bearer (.+)$/i);

  if (!match) {
    return res.status(401).json({ success: false, message: 'Missing Authorization' });
  }

  const token = match[1];

  // DEV-ONLY BYPASS: skip verification if flag is set
  // Set in backend .env: AUTH_BYPASS=true
  if (process.env.AUTH_BYPASS === 'true') {
    try {
      const decoded = decodeJwtPayload(token);

      // Firebase ID tokens include user_id in many cases; uid is also common.
      const uid = decoded.user_id || decoded.uid || decoded.sub;

      if (!uid) {
        return res.status(401).json({ success: false, message: 'Token decoded but uid missing' });
      }

      req.user = { uid, email: decoded.email || null, decoded };
      return next();
    } catch (e) {
      console.error('[AUTH_BYPASS] decode failed:', e.message);
      return res.status(401).json({ success: false, message: 'Invalid token (decode failed)' });
    }
  }

  // ✅ Normal secure path (will fail on your machine due to TLS trust issue)
  try {
    const decoded = await auth.verifyIdToken(token, true);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('[VerifyIdToken] FAILED', { code: err?.code, message: err?.message });
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};