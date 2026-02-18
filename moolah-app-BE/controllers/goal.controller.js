// controllers/goal.controller.js (MySQL - Computed Status Version)
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
};