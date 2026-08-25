/**
 * Setup Socket.IO main namespace for real-time workspace & collaboration synchronization
 */
function setupSyncSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket.IO /sync] Client connected: ${socket.id}`);

    // Join workspace room and user-specific room
    socket.on('join:workspace', ({ roomId, userId }) => {
      if (roomId) {
        socket.roomId = roomId;
        socket.userId = userId;
        const roomName = `workspace:${roomId}`;
        socket.join(roomName);
        console.log(`[Socket.IO /sync] Socket ${socket.id} joined room '${roomName}'`);
      }
      if (userId) {
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        console.log(`[Socket.IO /sync] Socket ${socket.id} joined user room '${userRoom}'`);
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

    // Real-time live code changes (Google Docs style)
    socket.on('code:change', ({ roomId, filepath, content, cursorPosition }) => {
      if (!roomId || !filepath) return;
      const roomName = `workspace:${roomId}`;
      // Broadcast to all other users in workspace except sender
      socket.to(roomName).emit('code:remote_change', {
        filepath,
        content,
        cursorPosition,
        senderSocketId: socket.id,
      });
    });

    // Real-time user active file selection & cursor indicators
    socket.on('cursor:move', ({ roomId, filepath, lineNumber, columnNumber, cursor, user }) => {
      if (!roomId) return;
      socket.roomId = roomId;
      if (user && user.id) {
        socket.userId = user.id;
      }
      const targetLine = lineNumber || (cursor && cursor.lineNumber) || 1;
      const targetCol = columnNumber || (cursor && cursor.columnNumber) || 1;
      socket.to(`workspace:${roomId}`).emit('cursor:remote_move', {
        filepath,
        lineNumber: targetLine,
        columnNumber: targetCol,
        user,
        socketId: socket.id,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO /sync] Client disconnected: ${socket.id}`);
      if (socket.roomId) {
        const uId = socket.userId || socket.id;
        socket.to(`workspace:${socket.roomId}`).emit('cursor:remote_remove', {
          userId: uId,
          socketId: socket.id,
        });
      }
    });
  });
}

module.exports = setupSyncSocket;
