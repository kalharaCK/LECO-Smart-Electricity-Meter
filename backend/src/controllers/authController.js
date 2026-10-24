const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Secure Cookie Configuration
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true, // Immune to JavaScript access (XSS mitigation)
    secure: isProd, // Transmit only over HTTPS in production
    sameSite: isProd ? 'strict' : 'lax', // Strict CSRF protection with local dev fallback
    maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
  };
};

const signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    // Disallow public signups from claiming 'staff' or 'admin' roles
    const requestedRole = (role || '').toLowerCase();
    const userRole = (requestedRole === 'staff' || requestedRole === 'admin') ? 'customer' : 'customer';

    const newUser = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email.trim().toLowerCase(), hashedPassword, userRole]
    );

    const token = jwt.sign(
      { id: newUser.rows[0].id, email: newUser.rows[0].email, role: newUser.rows[0].role },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Customer account created successfully',
      user: newUser.rows[0],
      token
    });
  } catch (err) {
    console.error('[Signup Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during signup' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('[Login Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
};

/**
 * Dedicated Staff Login endpoint
 * Rejects any non-staff account with 403 Forbidden
 */
const staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Staff email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid staff credentials' });
    }

    const user = userResult.rows[0];
    const role = (user.role || '').toLowerCase();
    if (role !== 'staff' && role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: This account does not possess LECO Staff privileges.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid staff credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.json({
      success: true,
      message: 'Staff authentication successful',
      user: { id: user.id, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('[Staff Login Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during staff login' });
  }
};

/**
 * Dedicated Customer Login endpoint
 * Rejects staff accounts attempting to access customer space
 */
const customerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const role = (user.role || '').toLowerCase();
    if (role === 'staff' || role === 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Staff accounts must sign in via the LECO Staff Operations Portal.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );

    res.cookie('token', token, getCookieOptions());

    res.json({
      success: true,
      message: 'Customer login successful',
      user: { id: user.id, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error('[Customer Login Error]:', err);
    res.status(500).json({ success: false, error: 'Server error during customer login' });
  }
};

const logout = (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const token = jwt.sign(
      { id: userResult.rows[0].id, email: userResult.rows[0].email, role: userResult.rows[0].role },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );
    res.json({ success: true, user: userResult.rows[0], token });
  } catch (err) {
    console.error('[getMe Error]:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

const getSessionToken = async (req, res) => {
  try {
    const email = req.body?.email || req.query?.email;
    if (email) {
      const userRes = await pool.query('SELECT id, email, role FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        const freshToken = jwt.sign(
          { id: u.id, email: u.email, role: u.role },
          process.env.JWT_SECRET || 'super_secret_jwt_key',
          { expiresIn: '1d' }
        );
        return res.json({ success: true, token: freshToken, user: u });
      }
    }

    let token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key');
        const userRes = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [decoded.id]);
        if (userRes.rows.length > 0) {
          return res.json({ success: true, token, user: userRes.rows[0] });
        }
      } catch (e) {}
    }

    return res.status(401).json({ success: false, message: 'No active session found' });
  } catch (err) {
    console.error('[Session Token Error]:', err);
    res.status(500).json({ success: false, error: 'Server error retrieving session token' });
  }
};

module.exports = { 
  signup, 
  login, 
  staffLogin, 
  customerLogin, 
  logout, 
  getMe, 
  getSessionToken 
};
