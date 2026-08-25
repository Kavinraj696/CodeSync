const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'codesync_super_secret_jwt_key_2026';

function normalizeUser(decoded) {
  if (!decoded) return null;
  const uid = String(decoded.userId || decoded.id || decoded._id || '');
  return {
    ...decoded,
    id: uid,
    userId: uid,
    _id: uid,
    username: decoded.username,
    email: decoded.email,
  };
}

/**
 * Middleware to verify JWT authentication token
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. No JWT token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = normalizeUser(decoded);
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Invalid or expired JWT token.' });
  }
}

/**
 * Optional token verification middleware (does not block if missing)
 */
function optionalToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = normalizeUser(decoded);
    } catch (e) {
      // Ignore invalid optional token
    }
  }
  next();
}

module.exports = {
  verifyToken,
  optionalToken,
  JWT_SECRET,
};
