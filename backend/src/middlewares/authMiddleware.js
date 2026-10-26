const jwt = require('jsonwebtoken');

/**
 * Validates JWT token from Authorization header or HTTP-only cookie
 */
const requireAuth = (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Authentication token required.' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized: Invalid or expired authentication token.' 
    });
  }
};

/**
 * Restricts route strictly to LECO Customer accounts.
 * Blocks staff accounts from accessing customer-scoped private data.
 */
const requireCustomer = (req, res, next) => {
  requireAuth(req, res, () => {
    const role = (req.user?.role || '').toLowerCase();
    if (role === 'customer' || role === 'user') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Customer access only. Staff members must use the Staff Operations Portal.'
    });
  });
};

/**
 * Restricts route strictly to LECO Staff and Grid Administrators.
 * Completely blocks customer tokens from accessing grid controls, meter relays, and all complaints.
 */
const requireStaff = (req, res, next) => {
  requireAuth(req, res, () => {
    const role = (req.user?.role || '').toLowerCase();
    if (role === 'staff' || role === 'admin') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Forbidden: LECO Staff privileges required. Access denied.'
    });
  });
};

const developmentOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Endpoint not found' });
  }
  return next();
};

module.exports = {
  requireAuth,
  requireCustomer,
  requireStaff,
  developmentOnly
};
