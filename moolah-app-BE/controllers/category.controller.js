// controllers/category.controller.js
const { admin, db } = require('../firebase/admin');

function catsCol(uid) {
  return db.collection('users').doc(uid).collection('categories');
}

function validate(body, { partial = false } = {}) {
  const errs = [];
  if (!partial) {
    if (!body.name) errs.push('name is required');
  }
  if (body.name !== undefined && typeof body.name !== 'string') errs.push('name must be a string');
  if (body.type !== undefined && !['expense', 'income', 'transfer'].includes(body.type)) {
    errs.push('type must be expense/income/transfer');
  }
  if (body.colour !== undefined && body.colour !== null && typeof body.colour !== 'string') {
    errs.push('colour must be a string or null');
  }
  if (body.parentId !== undefined && body.parentId !== null && typeof body.parentId !== 'string' && Number.isNaN(Number(body.parentId))) {
    errs.push('parentId must be a string, number, or null');
  }
  if (body.sortOrder !== undefined && Number.isNaN(Number(body.sortOrder))) errs.push('sortOrder must be a number');
  if (body.status !== undefined && !['active', 'archived'].includes(body.status)) errs.push('status must be active/archived');
  return errs;
}

exports.list = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const {
    status = 'active',
    parentId,
    topLevel,
    limit = 200,
    orderBy = 'sort_order',
    sort = 'asc',
  } = req.query;

  const lim = Math.min(parseInt(limit, 10) || 200, 500);
  const ob = (orderBy === 'name') ? 'name' : 'sortOrder';
  const dir = String(sort).toLowerCase() === 'desc' ? 'desc' : 'asc';

  let q = catsCol(uid);

  if (status) q = q.where('status', '==', status);

  if (topLevel === 'true') {
    q = q.where('parentId', '==', null);
  } else if (parentId !== undefined) {
    q = q.where('parentId', '==', parentId ? String(parentId) : null);
  }

  q = q.orderBy(ob, dir).orderBy('name', 'asc').limit(lim);

  const snap = await q.get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
};

exports.tree = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const snap = await catsCol(uid)
    .orderBy('sortOrder', 'asc')
    .orderBy('name', 'asc')
    .limit(500)
    .get();

  const items = snap.docs.map(d => ({ id: d.id, ...d.data(), children: [] }));
  const byId = new Map(items.map(i => [i.id, i]));
  const roots = [];

  for (const node of items) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  }

  res.json({ success: true, data: roots });
};

exports.getById = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const doc = await catsCol(uid).doc(String(req.params.id)).get();
  if (!doc.exists) return res.status(404).json({ error: 'Category not found' });

  res.json({ id: doc.id, ...doc.data() });
};

exports.create = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const errors = validate(req.body, { partial: false });
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const {
    name,
    type = 'expense',
    colour = null,
    parentId = null,
    sortOrder = 0,
    status = 'active',
  } = req.body;

  const cleanName = String(name).trim();
  const nameLower = cleanName.toLowerCase();

  const dup = await catsCol(uid).where('nameLower', '==', nameLower).limit(1).get();
  if (!dup.empty) return res.status(409).json({ error: 'Category with this name already exists' });

  if (parentId) {
    const p = await catsCol(uid).doc(String(parentId)).get();
    if (!p.exists) return res.status(400).json({ error: 'Invalid parentId' });
  }

  const payload = {
    name: cleanName,
    nameLower,
    type,
    colour: colour ?? null,
    parentId: parentId ? String(parentId) : null,
    sortOrder: Number(sortOrder) || 0,
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await catsCol(uid).add(payload);
  const created = await ref.get();

  res.status(201).json({ id: created.id, ...created.data() });
};

exports.update = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const ref = catsCol(uid).doc(String(req.params.id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'Category not found' });

  const errors = validate(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const patch = {};

  if (req.body.name !== undefined) {
    const newName = String(req.body.name).trim();
    const nameLower = newName.toLowerCase();

    const dups = await catsCol(uid).where('nameLower', '==', nameLower).limit(5).get();
    const clash = dups.docs.some(d => d.id !== String(req.params.id));
    if (clash) return res.status(409).json({ error: 'Category with this name already exists' });

    patch.name = newName;
    patch.nameLower = nameLower;
  }

  if (req.body.type !== undefined) patch.type = req.body.type;
  if (req.body.colour !== undefined) patch.colour = req.body.colour ?? null;

  if (req.body.parentId !== undefined) {
    const newParent = req.body.parentId ? String(req.body.parentId) : null;
    if (newParent) {
      if (newParent === String(req.params.id)) return res.status(400).json({ error: 'parentId cannot equal id' });
      const p = await catsCol(uid).doc(newParent).get();
      if (!p.exists) return res.status(400).json({ error: 'Invalid parentId' });
    }
    patch.parentId = newParent;
  }

  if (req.body.sortOrder !== undefined) patch.sortOrder = Number(req.body.sortOrder) || 0;
  if (req.body.status !== undefined) patch.status = req.body.status;

  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  await ref.set(patch, { merge: true });
  const updated = await ref.get();

  res.json({ id: updated.id, ...updated.data() });
};

exports.remove = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const cascade = String(req.query.cascade || '').toLowerCase() === 'true';

  const ref = catsCol(uid).doc(String(req.params.id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ error: 'Category not found' });

  const childSnap = await catsCol(uid).where('parentId', '==', String(req.params.id)).limit(1).get();
  const hasChildren = !childSnap.empty;

  if (!cascade && hasChildren) {
    return res.status(409).json({
      error: 'Category has children',
      message: 'Delete/move children first or call ?cascade=true',
    });
  }

  if (cascade) {
    const allChildren = await catsCol(uid).where('parentId', '==', String(req.params.id)).get();
    const batch = db.batch();
    batch.delete(ref);
    allChildren.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return res.status(204).send();
  }

  await ref.delete();
  res.status(204).send();
};