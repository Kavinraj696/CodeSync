const { authSocketMiddleware, getWorkspaceUserRole } = require('../middleware/authMiddleware');

/**
 * Setup Socket.IO main namespace for real-time workspace & collaboration synchronization
 */
function setupSyncSocket(io) {
  // Apply socket authentication middleware
  io.use(authSocketMiddleware);

  io.on('connection', (socket) => {
    console.log(`[Socket.IO /sync] Client connected: ${socket.id} (User: ${socket.user?.username || 'Anon'})`);

    // Join workspace room and user-specific room
    socket.on('join:workspace', async ({ roomId, userId }) => {
      const activeUserId = socket.user?.id || userId;
      if (roomId) {
        // Enforce membership check
        const role = await getWorkspaceUserRole(roomId, activeUserId);
        if (!role && process.env.NODE_ENV === 'production') {
          return socket.emit('error', { code: 'FORBIDDEN', message: 'Not a member of this workspace' });
        }

        socket.roomId = roomId;
        socket.userId = activeUserId;
        socket.role = role || 'editor';
        const roomName = `workspace:${roomId}`;
        socket.join(roomName);
        console.log(`[Socket.IO /sync] Socket ${socket.id} joined room '${roomName}' as ${socket.role}`);
      }
      if (activeUserId) {
        const userRoom = `user:${activeUserId}`;
        socket.join(userRoom);
      }
    });

    // Leave workspace room
    socket.on('leave:workspace', ({ roomId }) => {
      if (roomId) {
        const roomName = `workspace:${roomId}`;
        socket.leave(roomName);
        console.log(`[Socket.IO /sync] Socket ${socket.id} left room '${roomName}'`);
        const uId = socket.userId || socket.id;
        socket.to(roomName).emit('cursor:remote_remove', {
          userId: uId,
          socketId: socket.id,
        });
      }
    });

    // CRDT Yjs updates broadcasting (Single Source of Truth for collaborative editing)
    socket.on('crdt:update', ({ roomId, filepath, update }) => {
      // Step 12 Security Validation:
      // 1. Socket must be authenticated
      // 2. Socket must have joined requested workspace room
      // 3. User must not be a viewer
      // 4. roomId and filepath must be non-empty and valid
      if (!socket.user && process.env.NODE_ENV === 'production') return;
      if (!roomId || !filepath || !update) return;
      if (socket.roomId && socket.roomId !== roomId) return;
      if (socket.role === 'viewer') return;

      socket.to(`workspace:${roomId}`).emit('crdt:remote_update', {
        roomId,
        filepath,
        update,
        senderSocketId: socket.id,
      });
    });

    // Presence & cursor tracking
    socket.on('cursor:move', ({ roomId, filepath, lineNumber, columnNumber, selectionStart, selectionEnd, cursor, user }) => {
      if (!roomId) return;
      socket.roomId = roomId;
      const targetUser = socket.user || user || { id: socket.id, username: 'Collaborator' };
      const targetLine = lineNumber || (cursor && cursor.lineNumber) || 1;
      const targetCol = columnNumber || (cursor && cursor.columnNumber) || 1;
      
      socket.to(`workspace:${roomId}`).emit('cursor:remote_move', {
        filepath,
        lineNumber: targetLine,
        columnNumber: targetCol,
        selectionStart: selectionStart || 0,
        selectionEnd: selectionEnd || 0,
        user: targetUser,
        socketId: socket.id,
      });
    });

    // Explicit cursor removal on tab close / file switch
    socket.on('cursor:remove', ({ roomId, filepath }) => {
      if (!roomId) return;
      const uId = socket.user?.id || socket.userId || socket.id;
      socket.to(`workspace:${roomId}`).emit('cursor:remote_remove', {
        filepath,
        userId: uId,
        socketId: socket.id,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO /sync] Client disconnected: ${socket.id}`);
      if (socket.roomId) {
        const uId = socket.user?.id || socket.userId || socket.id;
        socket.to(`workspace:${socket.roomId}`).emit('cursor:remote_remove', {
          userId: uId,
          socketId: socket.id,
        });
      }
    });
  });
}

module.exports = setupSyncSocket;
