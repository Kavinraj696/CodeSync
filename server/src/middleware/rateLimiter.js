/**
 * Rate Limiting Middleware
 * Protects APIs against excessive requests and abuse.
 */

const requestCounts = new Map();

// Cleanup expired buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates a rate limiter middleware for HTTP requests
 * @param {number} windowMs Time window in milliseconds (default 1 min)
 * @param {number} maxRequests Maximum requests allowed per window (default 100)
 * @param {string} message Error message
 */
function rateLimiter({ windowMs = 60 * 1000, maxRequests = 100, message = 'Too many requests. Please try again later.' }) {
  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'global';
    const routeKey = `${key}:${req.baseUrl || req.path}`;
    const now = Date.now();

    let record = requestCounts.get(routeKey);
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    record.count += 1;
    requestCounts.set(routeKey, record);

    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message,
          retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
        },
      });
    }

    next();
  };
}

module.exports = { rateLimiter };
