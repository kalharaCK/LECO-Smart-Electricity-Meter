const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PAYHERE_WEBHOOK_PATH = '/api/payments/payhere-notify';

function createTrustedOriginGuard(allowedOrigins) {
  const trustedOrigins = new Set(allowedOrigins);

  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method) || req.path === PAYHERE_WEBHOOK_PATH) {
      return next();
    }

    const origin = req.get('origin');
    if (origin && trustedOrigins.has(origin)) return next();

    // Non-browser API clients may authenticate with an explicit bearer token.
    if (!origin && req.headers.authorization?.startsWith('Bearer ')) return next();
    // Permit origin-less public API calls only when no ambient session cookie is present.
    if (!origin && !req.cookies?.token) return next();

    return res.status(403).json({
      success: false,
      message: 'Request origin could not be verified.',
    });
  };
}

module.exports = { createTrustedOriginGuard };
