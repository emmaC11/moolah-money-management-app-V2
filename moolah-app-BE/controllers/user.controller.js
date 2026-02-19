const { admin, db } = require('../firebase/admin');

function userDoc(uid) {
  return db.collection('users').doc(uid);
}

function isAdmin(req) {
  const u = req.user || {};
  return (
    u.admin === true ||
    u.role === 'admin' ||
    (Array.isArray(u.roles) && u.roles.includes('admin')) ||
    u.claims?.admin === true
  );
}

function pickSelf(body) {
  const out = {};
  if (body.displayName !== undefined) out.displayName = String(body.displayName).trim();
  if (body.photoURL !== undefined) out.photoURL = body.photoURL ?? null;
  if (body.locale !== undefined) out.locale = String(body.locale).trim();
  if (body.timezone !== undefined) out.timezone = String(body.timezone).trim();
  if (body.currency !== undefined) out.currency = String(body.currency).trim();
  return out;
}

exports.me = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const doc = await userDoc(uid).get();

  let authUser = null;
  try { authUser = await admin.auth().getUser(uid); } catch (_) {}

  if (!doc.exists && !authUser) return res.status(404).json({ error: 'User not found' });

  const data = doc.exists ? doc.data() : {};

  res.json({
    id: uid,
    displayName: data.displayName ?? authUser?.displayName ?? null,
    email: data.email ?? authUser?.email ?? null,
    photoURL: data.photoURL ?? authUser?.photoURL ?? null,
    locale: data.locale ?? null,
    timezone: data.timezone ?? null,
    currency: data.currency ?? 'EUR',
    roles: Array.isArray(data.roles) ? data.roles : [],
    status: data.status ?? (authUser?.disabled ? 'disabled' : 'active'),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  });
};

exports.upsertMe = async (req, res) => {
  const { uid, email } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const base = pickSelf(req.body);
  if (email) base.email = email;

  const ref = userDoc(uid);
  const existing = await ref.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await ref.set(
    {
      ...base,
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
      ...(existing.exists ? {} : { currency: base.currency || 'EUR' }),
    },
    { merge: true }
  );

  try {
    await admin.auth().updateUser(uid, {
      displayName: base.displayName ?? undefined,
      photoURL: base.photoURL ?? undefined,
    });
  } catch (_) {}

  return exports.me(req, res);
};

exports.updateMe = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const updates = pickSelf(req.body);
  if (Object.keys(updates).length === 0) return exports.me(req, res);

  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await userDoc(uid).set(updates, { merge: true });
  
  try {
    await admin.auth().updateUser(uid, {
      displayName: updates.displayName ?? undefined,
      photoURL: updates.photoURL ?? undefined,
    });
  } catch (_) {}

  return exports.me(req, res);
};

exports.getById = async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { uid } = req.params;
  const doc = await userDoc(uid).get();

  let authUser = null;
  try { authUser = await admin.auth().getUser(uid); } catch (_) {}

  if (!doc.exists && !authUser) return res.status(404).json({ error: 'User not found' });

  const data = doc.exists ? doc.data() : {};

  res.json({
    id: uid,
    displayName: data.displayName ?? authUser?.displayName ?? null,
    email: data.email ?? authUser?.email ?? null,
    photoURL: data.photoURL ?? authUser?.photoURL ?? null,
    locale: data.locale ?? null,
    timezone: data.timezone ?? null,
    currency: data.currency ?? 'EUR',
    roles: Array.isArray(data.roles) ? data.roles : [],
    status: data.status ?? (authUser?.disabled ? 'disabled' : 'active'),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  });
};

exports.updateById = async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { uid } = req.params;

  const allowed = pickSelf(req.body);

  if (req.body.roles !== undefined) {
    if (!Array.isArray(req.body.roles)) return res.status(400).json({ error: 'roles must be an array' });
    allowed.roles = req.body.roles;
  }

  if (req.body.status !== undefined) {
    if (!['active', 'disabled', 'deleted'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    allowed.status = req.body.status;
  }

  allowed.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await userDoc(uid).set(allowed, { merge: true });

  if (allowed.status !== undefined) {
    try { await admin.auth().updateUser(uid, { disabled: allowed.status !== 'active' }); } catch (_) {}
  }

  if (allowed.displayName !== undefined || allowed.photoURL !== undefined) {
    try {
      await admin.auth().updateUser(uid, {
        displayName: allowed.displayName ?? undefined,
        photoURL: allowed.photoURL ?? undefined,
      });
    } catch (_) {}
  }

  return exports.getById(req, res);
};

exports.removeById = async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  const { uid } = req.params;
  const hard = String(req.query.hard || '').toLowerCase() === 'true';

  if (hard) {
    try { await admin.auth().deleteUser(uid); } catch (_) {}
    await userDoc(uid).delete();
    return res.status(204).send();
  }

  await userDoc(uid).set(
    { status: 'deleted', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  try { await admin.auth().updateUser(uid, { disabled: true }); } catch (_) {}
  return res.status(204).send();
};