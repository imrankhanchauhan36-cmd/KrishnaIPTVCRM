// Restricts access to specific roles (e.g. only 'owner' or 'admin')
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
};

// Restricts access to only Admin userType (not Employee)
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.userType !== 'Admin') {
    return res.status(403).json({ message: 'Only admin/owner can perform this action' });
  }
  next();
};

module.exports = { requireRole, requireAdmin };
