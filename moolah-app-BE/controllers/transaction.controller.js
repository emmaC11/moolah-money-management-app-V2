// controllers/transaction.controller.js
const { admin, db } = require('../firebase/admin');

function txCol(uid) {
  return db.collection('users').doc(uid).collection('transactions');
}
function catDoc(uid, categoryId) {
  return db.collection('users').doc(uid).collection('categories').doc(String(categoryId));
}
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

exports.list = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ success: false, message: 'Unauthenticated' });

  const {
    type,
    category_id,
    start_date,
    end_date,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  let q = txCol(uid);

  if (type && ['income', 'expense'].includes(type)) q = q.where('type', '==', type);
  if (category_id) q = q.where('categoryId', '==', String(category_id));

  // Dates stored as ISO strings 'YYYY-MM-DD' for easy range filtering
  if (start_date) q = q.where('date', '>=', String(start_date));
  if (end_date) q = q.where('date', '<=', String(end_date));

  // Stable ordering for pagination
  q = q.orderBy('date', 'desc').orderBy('createdAt', 'desc');

  // Total count (supported in newer Admin SDKs)
  let total = null;
  try {
    const countSnap = await q.count().get();
    total = countSnap.data().count;
  } catch (_) {}

  // Offset paging works, but cursor paging is more scalable long-term
  let snap;
  try {
    snap = await q.offset(offset).limit(lim).get();
  } catch (_) {
    const fallback = await q.limit(offset + lim).get();
    snap = { docs: fallback.docs.slice(offset) };
  }

  let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Firestore can't do SQL LIKE '%term%'. This is a page-only filter.
  if (search) {
    const s = String(search).toLowerCase();
    rows = rows.filter(r => String(r.description || '').toLowerCase().includes(s));
  }

  // Optional: attach category_name for display (best practice is to denormalise onto transactions)
  const categoryIds = [...new Set(rows.map(r => r.categoryId).filter(Boolean))];
  if (categoryIds.length) {
    const catRefs = categoryIds.map(id => catDoc(uid, id));
    const catSnaps = await db.getAll(...catRefs);
    const map = new Map();
    catSnaps.forEach(s => { if (s.exists) map.set(s.id, s.data()); });
    rows = rows.map(r => ({ ...r, category_name: map.get(r.categoryId)?.name || null }));
  }

  res.json({
    success: true,
    data: rows,
    pagination: {
      total,
      page: pg,
      limit: lim,
      totalPages: total === null ? null : Math.max(1, Math.ceil(total / lim)),
    },
  });
};

exports.getById = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ success: false, message: 'Unauthenticated' });

  const { id } = req.params;
  const doc = await txCol(uid).doc(String(id)).get();
  if (!doc.exists) return res.status(404).json({ success: false, message: 'Transaction not found' });

  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
};

exports.create = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ success: false, message: 'Unauthenticated' });

  const { category_id, amount, description = '', type, date } = req.body || {};
  if (!category_id || amount === undefined || !type || !date) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid type' });
  }
  const amt = toNumber(amount);
  if (amt === null || amt <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be positive' });
  }

  // Ensure category exists for this user and matches transaction type
  const catSnap = await catDoc(uid, category_id).get();
  if (!catSnap.exists) return res.status(400).json({ success: false, message: 'Invalid category_id' });
  const cat = catSnap.data();
  if (cat.type && cat.type !== type) {
    return res.status(400).json({
      success: false,
      message: `Category type (${cat.type}) does not match transaction type (${type})`,
    });
  }

  const payload = {
    categoryId: String(category_id),
    amount: amt,
    description: String(description || ''),
    type,
    date: String(date), // 'YYYY-MM-DD'
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await txCol(uid).add(payload);

  res.status(201).json({
    success: true,
    message: 'Transaction created successfully',
    data: { id: ref.id, ...payload },
  });
};

exports.update = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ success: false, message: 'Unauthenticated' });

  const { id } = req.params;
  const ref = txCol(uid).doc(String(id));
  const existing = await ref.get();
  if (!existing.exists) return res.status(404).json({ success: false, message: 'Transaction not found' });

  const patch = {};
  if (req.body.category_id !== undefined) patch.categoryId = String(req.body.category_id);
  if (req.body.amount !== undefined) {
    const amt = toNumber(req.body.amount);
    if (amt === null || amt <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });
    patch.amount = amt;
  }
  if (req.body.description !== undefined) patch.description = String(req.body.description || '');
  if (req.body.type !== undefined) {
    if (!['income', 'expense'].includes(req.body.type)) {
      return res.status(400).json({ success: false, message: 'Invalid type' });
    }
    patch.type = req.body.type;
  }
  if (req.body.date !== undefined) patch.date = String(req.body.date);

  // If category or type changes, re-validate match
  const merged = { ...existing.data(), ...patch };
  if (patch.categoryId !== undefined || patch.type !== undefined) {
    const catSnap = await catDoc(uid, merged.categoryId).get();
    if (!catSnap.exists) return res.status(400).json({ success: false, message: 'Invalid category_id' });
    const cat = catSnap.data();
    if (cat.type && merged.type && cat.type !== merged.type) {
      return res.status(400).json({
        success: false,
        message: `Category type (${cat.type}) does not match transaction type (${merged.type})`,
      });
    }
  }

  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await ref.set(patch, { merge: true });

  const updated = await ref.get();
  res.json({ success: true, data: { id: updated.id, ...updated.data() } });
};

exports.remove = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ success: false, message: 'Unauthenticated' });

  const { id } = req.params;
  const ref = txCol(uid).doc(String(id));
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ success: false, message: 'Transaction not found' });

  await ref.delete();
  res.status(204).send();
};