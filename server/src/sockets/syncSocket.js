const path = require('path');
const fs = require('fs');
const Y = require('yjs');
const { authSocketMiddleware, getWorkspaceUserRole } = require('../middleware/authMiddleware');
const Workspace = require('../models/Workspace');

// Server-side Yjs documents repository keyed by "roomId:filepath"
const workspaceDocs = new Map();

/**
 * Gets or creates a server-side Yjs document for a given workspace + file session.
 */
async function getOrCreateServerYDoc(roomId, filepath) {
  const docKey = `${roomId}:${filepath}`;
  if (workspaceDocs.has(docKey)) {
    return workspaceDocs.get(docKey);
  }

  const ydoc = new Y.Doc();
  const ytext = ydoc.getText('monaco');

  // Try to read initial file content from workspace directory on disk
  try {
    const workspace = await Workspace.findOne({
      $or: [{ roomId }, { id: roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }].filter(Boolean),
    });
    if (workspace && workspace.filepath) {
      const targetPath = path.normalize(path.join(workspace.filepath, filepath));
      if (targetPath.startsWith(workspace.filepath) && fs.existsSync(targetPath)) {
        const fileContent = fs.readFileSync(targetPath, 'utf8');
        if (fileContent && ytext.length === 0) {
          ytext.insert(0, fileContent);
        }
      }
    }
  } catch (err) {
    console.error('[CRDT] Error reading initial workspace file from disk:', err);
  }

  workspaceDocs.set(docKey, ydoc);
  return ydoc;
}

/**
 * Setup Socket.IO main namespace for real-time workspace & collaboration synchronization
 */
function setupSyncSocket(io) {
  // Apply socket authentication middleware
  io.use(authSocketMiddleware);

  io.on('connection', (socket) => {
    console.log(`[DEBUG-SOCKET] CONNECTED socket.id=${socket.id} (User: ${socket.user?.username || 'Anon'})`);

    // Join workspace room and user-specific room
    socket.on('join:workspace', async ({ roomId, userId }) => {
      const activeUserId = socket.user?.id || userId;
      console.log(`[DEBUG-ROOM] JOIN_RECEIVED socketId=${socket.id} roomId=${roomId} userId=${activeUserId}`);

      if (roomId) {
        // Enforce membership check
        const role = await getWorkspaceUserRole(roomId, activeUserId);
        console.log(`[DEBUG-ROOM] ROLE_RESULT roomId=${roomId} userId=${activeUserId} role=${role}`);

        if (!role && process.env.NODE_ENV === 'production') {
          return socket.emit('error', { code: 'FORBIDDEN', message: 'Not a member of this workspace' });
        }

        socket.roomId = roomId;
        socket.userId = activeUserId;
        socket.role = role || 'editor';

        // Join room by requested roomId
        const roomName1 = `workspace:${roomId}`;
        socket.join(roomName1);

        // Also resolve workspace from DB to join alternate room aliases (e.g. Mongo _id vs roomId)
        try {
          const ws = await Workspace.findOne({
            $or: [{ roomId }, { id: roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }].filter(Boolean),
          });
          if (ws) {
            if (ws.roomId) socket.join(`workspace:${ws.roomId}`);
            if (ws.id) socket.join(`workspace:${ws.id}`);
            if (ws._id) socket.join(`workspace:${ws._id.toString()}`);
          }
        } catch (e) {}

        const memberCount = io.sockets.adapter.rooms.get(roomName1)?.size || 0;
        console.log(`[DEBUG-ROOM] JOINED roomName='${roomName1}' socketId=${socket.id} role=${socket.role} memberCount=${memberCount}`);
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
        console.log(`[DEBUG-ROOM] LEFT roomName='${roomName}' socketId=${socket.id}`);
        const uId = socket.userId || socket.id;
        socket.to(roomName).emit('cursor:remote_remove', {
          userId: uId,
          socketId: socket.id,
        });
      }
    });

    // Handle initial Yjs document state request (Step 12)
    socket.on('crdt:doc_request', async ({ roomId, filepath }) => {
      if (!roomId || !filepath) return;
      try {
        const serverYDoc = await getOrCreateServerYDoc(roomId, filepath);
        const stateVector = Y.encodeStateAsUpdate(serverYDoc);
        const updateArray = Array.from(stateVector);

        console.log(`[DEBUG-CRDT] SERVER_DOC_RESPONSE socketId=${socket.id} roomId=${roomId} file=${filepath} bytes=${updateArray.length}`);
        socket.emit('crdt:doc_response', {
          roomId,
          filepath,
          update: updateArray,
        });
      } catch (err) {
        console.error('[DEBUG-CRDT] Error processing crdt:doc_request:', err);
      }
    });

    // CRDT Yjs updates broadcasting (Single Source of Truth for collaborative editing)
    socket.on('crdt:update', async ({ roomId, filepath, update }) => {
      // Step 15 Security Validation
      if (!socket.user && process.env.NODE_ENV === 'production') return;
      if (!roomId || !filepath || !update) return;
      if (socket.role === 'viewer') return;

      // Ensure socket is in the workspace room
      const roomName = `workspace:${roomId}`;
      if (!socket.rooms.has(roomName)) {
        socket.join(roomName);
      }

      const memberCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      const socketRoomsList = Array.from(socket.rooms);

      console.log(`[DEBUG-CRDT] SERVER_RECEIVE socketId=${socket.id} userId=${socket.user?.id || socket.userId} roomId=${roomId} file=${filepath} bytes=${update.length}`);
      console.log(`[DEBUG-ROOM] SOCKET_ROOMS rooms=${JSON.stringify(socketRoomsList)} roomMembers=${memberCount}`);

      // Apply update to server-side Y.Doc state
      try {
        const serverYDoc = await getOrCreateServerYDoc(roomId, filepath);
        Y.applyUpdate(serverYDoc, new Uint8Array(update));
      } catch (err) {
        console.error('[DEBUG-CRDT] Error applying update to server YDoc:', err);
      }

      console.log(`[DEBUG-CRDT] SERVER_BROADCAST roomId=${roomId} file=${filepath} toMembers=${memberCount}`);

      // Broadcast to room members except sender
      socket.to(roomName).emit('crdt:remote_update', {
        roomId,
        filepath,
        update,
        senderSocketId: socket.id,
      });

      // Also broadcast to alternate socket.roomId if different
      if (socket.roomId && socket.roomId !== roomId) {
        socket.to(`workspace:${socket.roomId}`).emit('crdt:remote_update', {
          roomId: socket.roomId,
          filepath,
          update,
          senderSocketId: socket.id,
        });
      }
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

    socket.on('disconnect', (reason) => {
      console.log(`[DEBUG-SOCKET] DISCONNECTED socketId=${socket.id} reason=${reason}`);
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
