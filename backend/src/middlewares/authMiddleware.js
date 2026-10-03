const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  // Prioritize explicit Authorization header from client over ambient cookies
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
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
