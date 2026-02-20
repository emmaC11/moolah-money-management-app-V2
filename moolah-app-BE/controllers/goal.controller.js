const { admin, db } = require('../firebase/admin');

function goalsCol(uid) {
  return db.collection('users').doc(uid).collection('goals');
}

function validate(body, { partial = false } = {}) {
  const errors = [];
  if (!partial) {
    if (!body.title) errors.push('title is required');
    if (body.targetAmount === undefined || body.targetAmount === null) errors.push('targetAmount is required');
  }
  const isNum = (v) => (v === undefined || v === null) ? true : !Number.isNaN(Number(v));
  if (body.title !== undefined && typeof body.title !== 'string') errors.push('title must be a string');
  if (!isNum(body.targetAmount)) errors.push('targetAmount must be a number');
  if (!isNum(body.currentAmount)) errors.push('currentAmount must be a number');
  if (body.currency !== undefined && typeof body.currency !== 'string') errors.push('currency must be a string');
  if (body.status !== undefined && !['active', 'completed', 'archived'].includes(body.status)) {
    errors.push('status must be one of: active, completed, archived');
  }
  return errors;
}

function computeStatus({ currentAmount, targetAmount, status }) {
  if (status === 'archived') return 'archived';
  const t = Number(targetAmount);
  const c = Number(currentAmount);
  if (!Number.isNaN(t) && t > 0 && !Number.isNaN(c) && c >= t) return 'completed';
  return status || 'active';
}

function withProgress(goal) {
  const t = Number(goal.targetAmount);
  const c = Number(goal.currentAmount);
  if (Number.isFinite(t) && t > 0 && Number.isFinite(c)) {
    return { ...goal, progress: Math.max(0, Math.min(100, Math.round((c / t) * 100))) };
  }
  return { ...goal, progress: null };
}

exports.list = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const {
    status,
    categoryId,
    dueBefore,
    dueAfter,
    orderBy = 'created_at',
    sort = 'desc',
    limit = 50,
  } = req.query;

  const lim = Math.min(parseInt(limit, 10) || 50, 200);
  const dir = String(sort).toLowerCase() === 'asc' ? 'asc' : 'desc';

  let q = goalsCol(uid);

  if (status) q = q.where('status', '==', status);
  if (categoryId) q = q.where('categoryId', '==', String(categoryId));
  if (dueAfter) q = q.where('dueDate', '>=', String(dueAfter));
  if (dueBefore) q = q.where('dueDate', '<=', String(dueBefore));

  const hasDueRange = !!(dueAfter || dueBefore);
  const ob = (orderBy === 'due_date') ? 'dueDate' : 'createdAt';

  q = q.orderBy(hasDueRange ? 'dueDate' : ob, dir).limit(lim);

  const snap = await q.get();
  res.json(snap.docs.map(d => withProgress({ id: d.id, ...d.data() })));
};

exports.getById = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const doc = await goalsCol(uid).doc(String(req.params.id)).get();
  if (!doc.exists) return res.status(404).json({ error: 'Goal not found' });

  res.json(withProgress({ id: doc.id, ...doc.data() }));
};

exports.create = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const errors = validate(req.body, { partial: false });
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const {
    title,
    targetAmount,
    currentAmount = 0,
    currency = 'EUR',
    dueDate = null,
    categoryId = null,
    notes = null,
    status,
  } = req.body;

  const payload = {
    title: String(title).trim(),
    targetAmount: Number(targetAmount),
    currentAmount: Number(currentAmount),
    currency,
    categoryId: categoryId ? String(categoryId) : null,
    notes: notes ?? null,
    status: computeStatus({ currentAmount, targetAmount, status }),
    dueDate: dueDate ?? null, // store 'YYYY-MM-DD' string
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await goalsCol(uid).add(payload);
  const created = await ref.get();

  res.status(201).json(withProgress({ id: created.id, ...created.data() }));
};

exports.update = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const ref = goalsCol(uid).doc(String(req.params.id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'Goal not found' });

  const errors = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const current = existing.data();

  const patch = {};
  if (req.body.title !== undefined) patch.title = String(req.body.title).trim();
  if (req.body.targetAmount !== undefined) patch.targetAmount = Number(req.body.targetAmount);
  if (req.body.currentAmount !== undefined) patch.currentAmount = Number(req.body.currentAmount);
  if (req.body.currency !== undefined) patch.currency = req.body.currency;
  if (req.body.categoryId !== undefined) patch.categoryId = req.body.categoryId ? String(req.body.categoryId) : null;
  if (req.body.notes !== undefined) patch.notes = req.body.notes ?? null;
  if (req.body.dueDate !== undefined) patch.dueDate = req.body.dueDate ?? null;

  const merged = { ...current, ...patch };
  patch.status = computeStatus({
    currentAmount: merged.currentAmount,
    targetAmount: merged.targetAmount,
    status: (req.body.status !== undefined ? req.body.status : merged.status),
  });

  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  await ref.set(patch, { merge: true });
  const updated = await ref.get();

  res.json(withProgress({ id: updated.id, ...updated.data() }));
};

exports.remove = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const ref = goalsCol(uid).doc(String(req.params.id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'Goal not found' });

  await ref.delete();
  res.status(204).send();
};