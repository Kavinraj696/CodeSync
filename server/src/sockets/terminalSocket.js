const { authSocketMiddleware, getWorkspaceUserRole } = require('../middleware/authMiddleware');
const terminalService = require('../services/terminalService');

/**
 * Setup Socket.IO namespace `/terminal` for real-time terminal streaming
 */
function setupTerminalSocket(io) {
  const terminalNamespace = io.of('/terminal');

  // Enforce JWT authentication on terminal namespace
  terminalNamespace.use(authSocketMiddleware);

  terminalNamespace.on('connection', (socket) => {
    console.log(`[Socket.IO /terminal] Client connected: ${socket.id} (User: ${socket.user?.username || 'Anon'})`);

    // Client requests terminal creation
    socket.on('terminal:start', async (payload, callback) => {
      try {
        const { roomId, cols, rows, language } = payload || {};

        // Enforce RBAC: Viewers cannot open terminal
        const role = await getWorkspaceUserRole(roomId, socket.user?.id);
        if (role === 'viewer') {
          throw new Error('Access denied: Read-only viewers cannot open terminal sessions');
        }

        const session = await terminalService.createTerminalSession(socket, {
          roomId,
          cols,
          rows,
          language,
        });

        if (typeof callback === 'function') {
          callback({ success: true, data: session });
        }
      } catch (error) {
        console.error('[Socket.IO /terminal] Error starting terminal:', error.message);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    // Keystrokes input from client
    socket.on('terminal:input', (payload) => {
      const { terminalId, data } = payload || {};
      if (terminalId && data) {
        terminalService.handleTerminalInput(terminalId, data);
      }
    });

    // Window resize from client
    socket.on('terminal:resize', (payload) => {
      const { terminalId, cols, rows } = payload || {};
      if (terminalId) {
        terminalService.handleTerminalResize(terminalId, cols, rows);
      }
    });

    // Explicit stop from client
    socket.on('terminal:stop', (payload) => {
      const { terminalId } = payload || {};
      if (terminalId) {
        terminalService.closeTerminalSession(terminalId);
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      console.log(`[Socket.IO /terminal] Client disconnected: ${socket.id}`);
      terminalService.cleanupSocketTerminals(socket.id);
    });
  });
}

module.exports = setupTerminalSocket;
