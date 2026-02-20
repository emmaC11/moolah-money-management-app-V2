module.exports = function requireAdmin(req, res, next) {
  // Supports either custom claim `admin: true` or roles array etc.
  const u = req.user || {};
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