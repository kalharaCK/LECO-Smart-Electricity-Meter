const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const meterRoutes = require('./routes/meterRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { sanitizeInputs } = require('./middlewares/sanitizer');

const app = express();

// Phase 5 Step 5: Apply HTTP Security Headers
// 1. Strip X-Powered-By to prevent framework fingerprinting
app.disable('x-powered-by');

// 2. Helmet middleware for CSP, Anti-Clickjacking (X-Frame-Options: DENY), and MIME-sniffing protection
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "http://localhost:3000",
          "http://localhost:5173",
          "http://localhost:5174",
          "https:"
        ],
        frameAncestors: ["'none'"], // CSP anti-clickjacking
      },
    },
    frameguard: {
      action: 'deny', // X-Frame-Options: DENY
    },
    noSniff: true, // X-Content-Type-Options: nosniff
    hidePoweredBy: true,
  })
);

// Middlewares
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// Phase 5 Step 6: Input Sanitization across all request bodies, queries, and params
app.use(sanitizeInputs);

// Routes
app.use('/api', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/notifications', notificationRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

module.exports = app;
