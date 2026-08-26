const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const { Server } = require('socket.io');
require('dotenv').config();

// Ensure DNS SRV records for MongoDB Atlas resolve reliably on Windows/ISP DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Use default DNS if custom servers unsupported
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is required in production mode!');
  process.exit(1);
}

const containerRoutes = require('./routes/containerRoutes');
const gitRoutes = require('./routes/gitRoutes');
const searchRoutes = require('./routes/searchRoutes');
const aiRoutes = require('./routes/aiRoutes');
const userRoutes = require('./routes/userRoutes');
const filesRoutes = require('./routes/filesRoutes');
const authRoutes = require('./routes/authRoutes');
const projectsRoutes = require('./routes/projectsRoutes');
const invitationsRoutes = require('./routes/invitationsRoutes');

const containerService = require('./services/containerService');
const setupTerminalSocket = require('./sockets/terminalSocket');
const setupSyncSocket = require('./sockets/syncSocket');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Setup Socket.IO namespaces & sync handlers
setupTerminalSocket(io);
setupSyncSocket(io);

// Expose io instance to Express controllers for real-time emissions
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Disable buffering so queries fail fast or can fallback when Mongo is disconnected
mongoose.set('bufferCommands', false);

// Health & Readiness Endpoints (Phase 29)
app.get('/api/live', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', async (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const isReady = mongoReady;

  res.status(isReady ? 200 : 503).json({
    success: isReady,
    status: isReady ? 'ready' : 'not_ready',
    services: {
      mongodb: mongoReady ? 'connected' : 'disconnected',
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongoState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

// Rate-limited Routes (Phase 13)
app.use('/api/auth', rateLimiter({ maxRequests: 20, message: 'Too many authentication attempts' }), authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/workspaces/:roomId/container', rateLimiter({ maxRequests: 30 }), containerRoutes);
app.use('/api/workspaces/:roomId/git', gitRoutes);
app.use('/api/workspaces/:roomId/search', searchRoutes);
app.use('/api/workspaces/:roomId/files', filesRoutes);
app.use('/api/ai', rateLimiter({ maxRequests: 25, message: 'AI rate limit exceeded' }), aiRoutes);
app.use('/api/users', userRoutes);

// Centralized Error Handler Middleware (Phase 27)
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal Server Error',
    },
  });
});

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codesync';
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('[MongoDB] Successfully connected to database.');

    // Start background idle container monitor (runs every 60 seconds)
    const idleTimeoutMinutes = parseInt(process.env.IDLE_TIMEOUT_MINUTES || '15', 10);
    setInterval(() => {
      containerService.checkIdleContainers(idleTimeoutMinutes);
    }, 60 * 1000);

    server.listen(PORT, () => {
      console.log(`[CodeSync v2 Server] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[MongoDB] Connection error:', err.message);
    server.listen(PORT, () => {
      console.log(`[CodeSync v2 Server] Running on http://localhost:${PORT} (without MongoDB)`);
    });
  });
