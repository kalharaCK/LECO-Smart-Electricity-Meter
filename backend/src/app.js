const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const staffRoutes = require('./routes/staffRoutes');
const customerRoutes = require('./routes/customerRoutes');
const meterRoutes = require('./routes/meterRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const predictionModule = require('./modules/prediction');
const chatbotModule = require('./modules/chatbot');
const { sanitizeInputs } = require('./middlewares/sanitizer');
const { errorHandler } = require('./middlewares/errorHandler');
const { createTrustedOriginGuard } = require('./middlewares/csrfProtection');
const { createHealthResponse } = require('./services/healthStatus');
const { requireAuth } = require('./middlewares/authMiddleware');
const { handlePayhereNotify, initPayhereCheckout, completePayhereCheckout } = require('./controllers/payhereController');
const { pool } = require('./config/db');

const app = express();

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
          "http://127.0.0.1:5173",
          "http://127.0.0.1:5174",
          "ws://localhost:3000",
          "wss://localhost:3000",
          "https:"
        ],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    hidePoweredBy: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// 3. CORS Configuration supporting Customer (5173) and Staff (5174) portals
const production = process.env.NODE_ENV === 'production';
const corsOrigins = production
  ? [process.env.FRONTEND_URL, process.env.STAFF_FRONTEND_URL].filter(Boolean)
  : [process.env.FRONTEND_URL || 'http://localhost:5173', process.env.STAFF_FRONTEND_URL || 'http://localhost:5174',
      'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or curl requests without origin
    if (!origin || corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));

// 4. Body parsing & cookie middleware
app.use(cookieParser());
app.use(createTrustedOriginGuard(corsOrigins));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// 5. Input Sanitization against XSS & script injection
app.use(sanitizeInputs);

// 6. Primary REST API Routes
// Authentication
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // Backwards compatibility for /api/login, /api/signup, /api/logout

// Dedicated Staff Operations Portal Routes (Guarded by requireStaff)
app.use('/api/staff', staffRoutes);

// Dedicated Customer Portal Routes (Guarded by requireCustomer)
app.use('/api/customer', customerRoutes);

// Backwards-compatible routes with strict security guards in place
app.use('/api/meters', meterRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatbotModule.router);
app.use('/api/prediction', predictionModule.router);
app.use('/api/settings', settingsRoutes);

// PayHere Payment Gateway Handlers & Server-to-Server IPN Webhook
app.post('/api/payments/payhere-notify', handlePayhereNotify);
app.post('/api/payments/payhere-init', requireAuth, initPayhereCheckout);
app.post('/api/payments/payhere-complete', requireAuth, completePayhereCheckout);

// 7. REST Health & Diagnostics Check
app.get('/api/health', async (req, res) => {
  let databaseHealthy = true;
  let dbLatencyMs = 0;
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    databaseHealthy = false;
  }

  const health = createHealthResponse({
    databaseHealthy,
    dbLatencyMs,
    uptimeSeconds: Math.floor(process.uptime()),
  });
  res.status(health.httpStatus).json(health.body);
});

// 8. 404 Handler for unknown endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    status: 404
  });
});

// 9. Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
