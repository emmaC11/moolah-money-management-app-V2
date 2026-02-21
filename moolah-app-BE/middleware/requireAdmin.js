// middleware/requireAdmin.js
module.exports = function requireAdmin(req, res, next) {
  const u = req.user || {};

  // Support common admin patterns (custom claim or roles)
  const isAdmin =
    u.admin === true ||
    u.role === 'admin' ||
    (Array.isArray(u.roles) && u.roles.includes('admin')) ||
    (u.claims && u.claims.admin === true);

  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }

  return next();
};