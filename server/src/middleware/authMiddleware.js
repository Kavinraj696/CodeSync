const jwt = require('jsonwebtoken');
const Workspace = require('../models/Workspace');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable must be set in production mode!');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'codesync_super_secret_jwt_key_2026';

function normalizeUser(decoded) {
  if (!decoded) return null;
  const uid = String(decoded.userId || decoded.id || decoded._id || '');
  return {
    ...decoded,
    id: uid,
    userId: uid,
    _id: uid,
    username: decoded.username || 'User',
    email: decoded.email || '',
  };
}

/**
 * Express HTTP authentication middleware
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required. No JWT token provided.' },
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = normalizeUser(decoded);
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID', message: 'Invalid or expired authentication token.' },
    });
  }
}

/**
 * Optional HTTP token middleware
 */
function optionalToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : req.query.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = normalizeUser(decoded);
    } catch (e) {
      // Ignore optional token errors
    }
  }
  next();
}

/**
 * Socket.IO handshake authentication middleware
 */
function authSocketMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      (socket.handshake.headers?.authorization || '').replace('Bearer ', '');

    if (!token) {
      // Allow anonymous fallback in dev if enabled, else reject
      if (process.env.ALLOW_ANONYMOUS_SOCKET === 'true') {
        socket.user = { id: 'anon_' + socket.id.slice(0, 6), username: 'Anonymous' };
        return next();
      }
      return next(new Error('Authentication required: Missing JWT token'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = normalizeUser(decoded);
    next();
  } catch (err) {
    return next(new Error('Authentication failed: Invalid or expired token'));
  }
}

/**
 * Get workspace role for user
 */
async function getWorkspaceUserRole(roomId, userId) {
  if (!roomId || !userId) return null;
  try {
    const workspace = await Workspace.findOne({ roomId });
    if (!workspace) return null;

    const uStr = String(userId);
    if (workspace.owner && String(workspace.owner) === uStr) {
      return 'owner';
    }

    const collaborator = (workspace.collaborators || []).find(
      (c) => String(c.user?._id || c.user) === uStr
    );

    return collaborator ? collaborator.role : null;
  } catch (e) {
    return null;
  }
}

/**
 * Check if user is a viewer in workspace
 */
async function isViewerUser(roomId, reqOrUserId) {
  const userId = typeof reqOrUserId === 'object' ? reqOrUserId?.user?.id : reqOrUserId;
  const role = await getWorkspaceUserRole(roomId, userId);
  return role === 'viewer';
}

/**
 * Helper middleware requiring specific workspace role
 */
function requireWorkspaceRole(allowedRoles = ['owner', 'editor']) {
  return async (req, res, next) => {
    const roomId = req.params.roomId || req.body.roomId || req.query.roomId;
    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: { code: 'WORKSPACE_REQUIRED', message: 'Workspace roomId is required.' },
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'User authentication required.' },
      });
    }

    const role = await getWorkspaceUserRole(roomId, userId);
    if (!role) {
      return res.status(403).json({
        success: false,
        error: { code: 'WORKSPACE_FORBIDDEN', message: 'Access denied: You are not a member of this workspace.' },
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'ROLE_FORBIDDEN', message: `Access denied: Action requires one of roles: [${allowedRoles.join(', ')}]. Your role is '${role}'.` },
      });
    }

    req.workspaceRole = role;
    next();
  };
}

module.exports = {
  verifyToken,
  optionalToken,
  authSocketMiddleware,
  getWorkspaceUserRole,
  isViewerUser,
  requireWorkspaceRole,
  JWT_SECRET,
};
