// controllers/transaction.controller.js
const { admin, db } = require('../firebase/admin');

function txCol(uid) {
  return db.collection('users').doc(uid).collection('transactions');
}

function isNum(v) {
  return v === undefined || v === null ? false : !Number.isNaN(Number(v));
}

function validate(body, { partial = false } = {}) {
  const errors = [];

  if (!partial) {
    if (!body.type) errors.push('type is required');
    if (body.amount === undefined || body.amount === null) errors.push('amount is required');
    if (!body.date) errors.push('date is required');
  }

  if (body.type !== undefined && !['income', 'expense'].includes(body.type)) {
    errors.push('type must be income or expense');
  }

  if (body.amount !== undefined && !isNum(body.amount)) errors.push('amount must be a number');
  if (body.amount !== undefined && Number(body.amount) <= 0) errors.push('amount must be positive');

  if (body.description !== undefined && typeof body.description !== 'string') {
    errors.push('description must be a string');
  }

  if (body.date !== undefined && typeof body.date !== 'string') {
    errors.push('date must be a string (e.g. YYYY-MM-DD)');
  }

  if (body.categoryId !== undefined && body.categoryId !== null && typeof body.categoryId !== 'string') {
    errors.push('categoryId must be a string or null');
  }

  return errors;
}
// GET /api/v1/transactions
exports.list = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const {
    type,
    categoryId,
    startDate,
    endDate,
    search,
    limit = 50,
  } = req.query;

  const lim = Math.min(parseInt(limit, 10) || 50, 200);

  let q = txCol(uid);

  if (type && ['income', 'expense'].includes(type)) q = q.where('type', '==', type);
  if (categoryId) q = q.where('categoryId', '==', String(categoryId));

  // Dates stored as 'YYYY-MM-DD' strings
  if (startDate) q = q.where('date', '>=', String(startDate));
  if (endDate) q = q.where('date', '<=', String(endDate));

  // Firestore needs an orderBy when using range filters; use date then createdAt
  q = q.orderBy('date', 'desc').orderBy('createdAt', 'desc').limit(lim);

  const snap = await q.get();

  let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Simple search filter (client-side) for description text
  if (search) {
    const s = String(search).toLowerCase();
    items = items.filter(x => String(x.description || '').toLowerCase().includes(s));
  }

  // Plain array response
  return res.json(items);
};

// GET /api/v1/transactions/:id
exports.getById = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const doc = await txCol(uid).doc(String(req.params.id)).get();
  if (!doc.exists) return res.status(404).json({ success: false, message: 'Transaction not found' });

  return res.json({ success: true, data: { id: doc.id, ...doc.data() } });
};

// POST /api/v1/transactions
exports.create = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const errors = validate(req.body, { partial: false });
  if (errors.length) {
    return res.status(400).json({ success: false, message: 'Validation failed', details: errors });
  }

  const { amount, description = '', type, date, categoryId = null } = req.body;

  const payload = {
    amount: Number(amount),
    description: String(description),
    type,
    date: String(date), // 'YYYY-MM-DD'
    categoryId: categoryId ? String(categoryId) : null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await txCol(uid).add(payload);
  const created = await ref.get();

  return res.status(201).json({
    success: true,
    message: 'Transaction created successfully',
    data: { id: created.id, ...created.data() },
  });
};

// PUT /api/v1/transactions/:id
exports.update = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const errors = validate(req.body, { partial: true });
  if (errors.length) {
    return res.status(400).json({ success: false, message: 'Validation failed', details: errors });
  }

  const ref = txCol(uid).doc(String(req.params.id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ success: false, message: 'Transaction not found' });

  const patch = {};
  if (req.body.amount !== undefined) patch.amount = Number(req.body.amount);
  if (req.body.description !== undefined) patch.description = String(req.body.description);
  if (req.body.type !== undefined) patch.type = req.body.type;
  if (req.body.date !== undefined) patch.date = String(req.body.date);
  if (req.body.categoryId !== undefined) patch.categoryId = req.body.categoryId ? String(req.body.categoryId) : null;

  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  await ref.set(patch, { merge: true });
  const updated = await ref.get();

  return res.json({
    success: true,
    message: 'Transaction updated',
    data: { id: updated.id, ...updated.data() },
  });
};

// DELETE /api/v1/transactions/:id
exports.remove = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const ref = txCol(uid).doc(String(req.params.id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ success: false, message: 'Transaction not found' });

  await ref.delete();
  return res.status(204).send();
};