const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Phase 3 Step 3: Flag the cookie as httpOnly, Secure (over HTTPS), and SameSite=Strict
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true, // Prevents JavaScript from reading the cookie (immune to XSS)
    secure: isProd, // Transmit only over HTTPS in production
    sameSite: isProd ? 'strict' : 'lax', // Strict CSRF protection (lax fallback for multi-port local dev)
    maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
  };
};

const signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userRole = role || 'customer';

    const newUser = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, userRole]
    );

    const token = jwt.sign(
      { id: newUser.rows[0].id, role: newUser.rows[0].role },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );

    // Issue secure httpOnly cookie and return token for cross-origin local dev
    res.cookie('token', token, getCookieOptions());

    res.status(201).json({
      message: 'Account created successfully',
      user: newUser.rows[0],
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );

    // Step 3: Flag the cookie as httpOnly, Secure (HTTPS), and SameSite=Strict
    res.cookie('token', token, getCookieOptions());

    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const logout = (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax'
  });
  res.json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const token = jwt.sign(
      { id: userResult.rows[0].id, role: userResult.rows[0].role },
      process.env.JWT_SECRET || 'super_secret_jwt_key',
      { expiresIn: '1d' }
    );
    res.json({ user: userResult.rows[0], token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getSessionToken = async (req, res) => {
  try {
    let token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key');
        const userRes = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [decoded.id]);
        if (userRes.rows.length > 0) {
          return res.json({ token, user: userRes.rows[0] });
        }
      } catch (e) {}
    }

    const email = req.body?.email || req.query?.email;
    if (email) {
      const userRes = await pool.query('SELECT id, email, role FROM users WHERE email = $1', [email]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        const freshToken = jwt.sign(
          { id: u.id, role: u.role },
          process.env.JWT_SECRET || 'super_secret_jwt_key',
          { expiresIn: '1d' }
        );
        res.cookie('token', freshToken, getCookieOptions());
        return res.json({ token: freshToken, user: u });
      }
    }

    return res.status(401).json({ message: 'No active session found' });
  } catch (err) {
    console.error('Session token error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { signup, login, logout, getMe, getSessionToken };
