const { admin, db } = require('../firebase/admin');

function goalsCol(uid) {
  return db.collection('users').doc(uid).collection('goals');
}
// controllers/goal.controller.js (MySQL - Computed Status Version)
const pool = require('../config/database');

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
const formatGoalData = (goal) => {
  const target = Number(goal.targetAmount || goal.target_amount);
  const current = Number(goal.currentAmount || goal.current_amount);
  
  return {
    ...goal,
    status: (current >= target && target > 0) ? 'completed' : 'active',
    progress: target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0
  };
};

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
 const { uid } = req.user || {};
  const safeLimit = 200;

  try {
    const [rows] = await pool.query(
      `SELECT goal_id AS id, user_id AS userId, goal_name as title, target_amount AS targetAmount,
              current_amount AS currentAmount, 
              target_date AS dueDate, created_at AS createdAt
         FROM Goals
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      [uid, safeLimit]
    );

    const formattedData = rows.map(formatGoalData);

    res.json({ success: true, data: formattedData });
  } catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.getById = async (req, res) => {
  const { uid } = req.user || {};
  if (!uid) return res.status(401).json({ error: 'Unauthenticated' });

  const doc = await goalsCol(uid).doc(String(req.params.id)).get();
  if (!doc.exists) return res.status(404).json({ error: 'Goal not found' });

  res.json(withProgress({ id: doc.id, ...doc.data() }));

 const { uid } = req.user || {};
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT goal_id AS id, user_id AS userId, goal_name as title, target_amount AS targetAmount,
              current_amount AS currentAmount, target_date AS dueDate
         FROM Goals WHERE goal_id = ? AND user_id = ?`,
      [Number(id), uid]
    );

    if (!rows[0]) return res.status(404).json({ success: false, error: 'Goal not found' });

    res.json({ success: true, data: formatGoalData(rows[0]) });
 } catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
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
  const { title, targetAmount, currentAmount = 0, dueDate = null } = req.body;

  if (!title || targetAmount === undefined) {
    return res.status(400).json({ success: false, error: 'Title and targetAmount are required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO Goals (user_id, goal_name, target_amount, current_amount, target_date)
       VALUES (?, ?, ?, ?, ?)`,
      [uid, title.trim(), Number(targetAmount), Number(currentAmount), dueDate]
    );

    const newGoal = formatGoalData({
      id: result.insertId,
      userId: uid,
      title,
      targetAmount,
      currentAmount,
      dueDate
    });

    res.status(201).json({ success: true, data: newGoal });
 } catch (err) {
  console.error("DEBUG ERROR:", err); 
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
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
//SQL Version
const pool = require('../config/database');

const formatGoalData = (goal) => {
  const target = Number(goal.targetAmount || goal.target_amount);
  const current = Number(goal.currentAmount || goal.current_amount);
  
  return {
    ...goal,
    status: (current >= target && target > 0) ? 'completed' : 'active',
    progress: target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0
  };
};

exports.list = async (req, res) => {
 const { uid } = req.user || {};
  const safeLimit = 200;

  try {
    const [rows] = await pool.query(
      `SELECT goal_id AS id, user_id AS userId, goal_name as title, target_amount AS targetAmount,
              current_amount AS currentAmount, 
              target_date AS dueDate, created_at AS createdAt
         FROM Goals
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      [uid, safeLimit]
    );

    const formattedData = rows.map(formatGoalData);

    res.json({ success: true, data: formattedData });
  } catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.getById = async (req, res) => {

 const { uid } = req.user || {};
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT goal_id AS id, user_id AS userId, goal_name as title, target_amount AS targetAmount,
              current_amount AS currentAmount, target_date AS dueDate
         FROM Goals WHERE goal_id = ? AND user_id = ?`,
      [Number(id), uid]
    );

    if (!rows[0]) return res.status(404).json({ success: false, error: 'Goal not found' });

    res.json({ success: true, data: formatGoalData(rows[0]) });
 } catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.create = async (req, res) => {
  const { uid } = req.user || {};
  const { title, targetAmount, currentAmount = 0, dueDate = null } = req.body;

  if (!title || targetAmount === undefined) {
    return res.status(400).json({ success: false, error: 'Title and targetAmount are required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO Goals (user_id, goal_name, target_amount, current_amount, target_date)
       VALUES (?, ?, ?, ?, ?)`,
      [uid, title.trim(), Number(targetAmount), Number(currentAmount), dueDate]
    );

    const newGoal = formatGoalData({
      id: result.insertId,
      userId: uid,
      title,
      targetAmount,
      currentAmount,
      dueDate
    });

    res.status(201).json({ success: true, data: newGoal });
 } catch (err) {
  console.error("DEBUG ERROR:", err); 
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.update = async (req, res) => {
  const { uid } = req.user || {};
  const { id } = req.params;
  const body = req.body;

  const { id } = req.params;
  const body = req.body;

  const fields = []; const params = [];
  if (body.title !== undefined) { fields.push('goal_name = ?'); params.push(body.title.trim()); }
  if (body.targetAmount !== undefined) { fields.push('target_amount = ?'); params.push(Number(body.targetAmount)); }
  if (body.currentAmount !== undefined) { fields.push('current_amount = ?'); params.push(Number(body.currentAmount)); }
  if (body.dueDate !== undefined) { fields.push('target_date = ?'); params.push(body.dueDate); }

  if (fields.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

  try {
    const [result] = await pool.execute(
      `UPDATE Goals SET ${fields.join(', ')} WHERE goal_id = ? AND user_id = ?`,
      [...params, Number(id), uid]
    );

    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Goal not found' });

    res.json({ success: true, message: 'Goal updated' });
} catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.remove = async (req, res) => {
  const { uid } = req.user || {};
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      `DELETE FROM Goals WHERE goal_id = ? AND user_id = ?`, 
      [Number(id), uid]
    );
    
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Goal not found' });
    
    res.status(204).send();
 } catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

/*// controllers/goal.controller.js (MySQL - Computed Status Version)
const pool = require('../config/database');

const formatGoalData = (goal) => {
  const target = Number(goal.targetAmount || goal.target_amount);
  const current = Number(goal.currentAmount || goal.current_amount);
  
  return {
    ...goal,
    status: (current >= target && target > 0) ? 'completed' : 'active',
    progress: target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0
  };
};

exports.list = async (req, res) => {
 const { uid } = req.user || {};
  const safeLimit = 200;

  try {
    const [rows] = await pool.query(
      `SELECT goal_id AS id, user_id AS userId, goal_name as title, target_amount AS targetAmount,
              current_amount AS currentAmount, 
              target_date AS dueDate, created_at AS createdAt
         FROM Goals
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      [uid, safeLimit]
    );

    const formattedData = rows.map(formatGoalData);

    res.json({ success: true, data: formattedData });
  } catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.getById = async (req, res) => {

 const { uid } = req.user || {};
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT goal_id AS id, user_id AS userId, goal_name as title, target_amount AS targetAmount,
              current_amount AS currentAmount, target_date AS dueDate
         FROM Goals WHERE goal_id = ? AND user_id = ?`,
      [Number(id), uid]
    );

    if (!rows[0]) return res.status(404).json({ success: false, error: 'Goal not found' });

    res.json({ success: true, data: formatGoalData(rows[0]) });
 } catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.create = async (req, res) => {
  const { uid } = req.user || {};
  const { title, targetAmount, currentAmount = 0, dueDate = null } = req.body;

  if (!title || targetAmount === undefined) {
    return res.status(400).json({ success: false, error: 'Title and targetAmount are required' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO Goals (user_id, goal_name, target_amount, current_amount, target_date)
       VALUES (?, ?, ?, ?, ?)`,
      [uid, title.trim(), Number(targetAmount), Number(currentAmount), dueDate]
    );

    const newGoal = formatGoalData({
      id: result.insertId,
      userId: uid,
      title,
      targetAmount,
      currentAmount,
      dueDate
    });

    res.status(201).json({ success: true, data: newGoal });
 } catch (err) {
  console.error("DEBUG ERROR:", err); 
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.update = async (req, res) => {
  const { uid } = req.user || {};
  const { id } = req.params;
  const body = req.body;

  const fields = []; const params = [];
  if (body.title !== undefined) { fields.push('goal_name = ?'); params.push(body.title.trim()); }
  if (body.targetAmount !== undefined) { fields.push('target_amount = ?'); params.push(Number(body.targetAmount)); }
  if (body.currentAmount !== undefined) { fields.push('current_amount = ?'); params.push(Number(body.currentAmount)); }
  if (body.dueDate !== undefined) { fields.push('target_date = ?'); params.push(body.dueDate); }

  if (fields.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

  try {
    const [result] = await pool.execute(
      `UPDATE Goals SET ${fields.join(', ')} WHERE goal_id = ? AND user_id = ?`,
      [...params, Number(id), uid]
    );

    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Goal not found' });

    res.json({ success: true, message: 'Goal updated' });
} catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};

exports.remove = async (req, res) => {
  const { uid } = req.user || {};
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      `DELETE FROM Goals WHERE goal_id = ? AND user_id = ?`, 
      [Number(id), uid]
    );
    
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Goal not found' });
    
    res.status(204).send();
 } catch (err) {
  console.error("DEBUG ERROR:", err);
  res.status(500).json({ 
    success: false, 
    error: 'Database error', 
    message: err.message
  });
}
};*/
