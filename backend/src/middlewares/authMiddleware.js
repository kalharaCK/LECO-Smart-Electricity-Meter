const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  // Step 3: Check httpOnly cookie first (XSS-safe), fallback to Bearer header
  let token = req.cookies?.token;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized, no authentication token found' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key');
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized, invalid or expired token' });
  }
};

module.exports = { requireAuth };
