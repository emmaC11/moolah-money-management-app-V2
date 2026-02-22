// controllers/budget.controller.js
const { admin, db } = require('../firebase/admin');

function budgetsCol(uid) {
  return db.collection('users').doc(uid).collection('budgets');
}

function validate(body, { partial = false } = {}) {
  const errors = [];
  if (!partial) {
    if (!body.name) errors.push('name is required');
    if (body.amount === undefined || body.amount === null) errors.push('amount is required');
    if (!body.categoryId) errors.push('categoryId is required');
  }
  if (body.name !== undefined && typeof body.name !== 'string') errors.push('name must be a string');
  if (body.amount !== undefined && Number.isNaN(Number(body.amount))) errors.push('amount must be a number');
  if (body.currency !== undefined && typeof body.currency !== 'string') errors.push('currency must be a string');
  if (body.categoryId !== undefined && body.categoryId !== null && typeof body.categoryId !== 'string') errors.push('categoryId must be a string');
  return errors;
}

exports.list = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  const snap = await budgetsCol(uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

exports.getById = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const doc = await budgetsCol(uid).doc(String(req.params.id)).get();
  if (!doc.exists) return res.status(404).json({ error: 'Budget not found' });

  res.json({ id: doc.id, ...doc.data() });
};

exports.create = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const errors = validate(req.body, { partial: false });
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const { name, amount, currency = 'EUR', periodStart = null, periodEnd = null, categoryId } = req.body;

  const payload = {
    name: String(name).trim(),
    amount: Number(amount),
    currency,
    categoryId: String(categoryId),
    periodStart: periodStart || null,
    periodEnd: periodEnd || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await budgetsCol(uid).add(payload);
  const created = await ref.get();

  res.status(201).json({ id: created.id, ...created.data() });
};

exports.update = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const errors = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const ref = budgetsCol(uid).doc(String(req.params.id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'Budget not found' });

  const patch = {};
  if (req.body.name !== undefined) patch.name = String(req.body.name).trim();
  if (req.body.amount !== undefined) patch.amount = Number(req.body.amount);
  if (req.body.currency !== undefined) patch.currency = req.body.currency;
  if (req.body.categoryId !== undefined) patch.categoryId = req.body.categoryId ? String(req.body.categoryId) : null;
  if (req.body.periodStart !== undefined) patch.periodStart = req.body.periodStart || null;
  if (req.body.periodEnd !== undefined) patch.periodEnd = req.body.periodEnd || null;

  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  await ref.set(patch, { merge: true });
  const updated = await ref.get();

  res.json({ id: updated.id, ...updated.data() });
};

exports.remove = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const ref = budgetsCol(uid).doc(String(req.params.id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'Budget not found' });

  await ref.delete();
  res.status(204).send();
};