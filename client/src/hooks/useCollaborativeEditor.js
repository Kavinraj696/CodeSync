import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

/**
 * Custom hook managing Yjs CRDT document lifecycle & official y-monaco binding.
 * Serves as the SINGLE SOURCE OF TRUTH for real-time collaborative text editing.
 */
export function useCollaborativeEditor({
  editor,
  monaco,
  filepath,
  roomId,
  socket,
  initialValue = '',
  readOnly = false,
}) {
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);

  useEffect(() => {
    if (!editor || !monaco || !filepath || !roomId || !socket) return;

    console.log(`[CRDT] JOIN workspace=${roomId} file=${filepath}`);

    // 1. Create file-scoped Y.Doc
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ytext = ydoc.getText('monaco');

    const monacoModel = editor.getModel();
    if (!monacoModel) return;

    // 2. Initial document content seeding (deterministic - only once if Y.Text is empty)
    if (ytext.length === 0 && initialValue) {
      ydoc.transact(() => {
        ytext.insert(0, initialValue);
      }, 'init');
    }

    // 3. Bind Monaco Model to Y.Text using official y-monaco MonacoBinding
    const binding = new MonacoBinding(
      ytext,
      monacoModel,
      new Set([editor])
    );
    bindingRef.current = binding;

    // 4. Listen for local Y.Doc updates and broadcast over Socket.IO
    const handleYdocUpdate = (update, origin) => {
      // Do NOT re-emit updates received from remote sockets
      if (origin === 'remote' || readOnly) return;

      const updateArray = Array.from(update);
      console.log(`[CRDT] LOCAL UPDATE file=${filepath} bytes=${updateArray.length}`);

      socket.emit('crdt:update', {
        roomId,
        filepath,
        update: updateArray,
      });
    };

    ydoc.on('update', handleYdocUpdate);

    // 5. Listen for incoming remote CRDT updates from Socket.IO
    const handleRemoteUpdate = ({ filepath: incomingPath, update, roomId: incomingRoomId }) => {
      if (incomingPath !== filepath) return;
      if (incomingRoomId && incomingRoomId !== roomId) return;
      if (!update || !ydocRef.current) return;

      console.log(`[CRDT] REMOTE UPDATE file=${filepath} bytes=${update.length}`);
      try {
        const updateUint8 = new Uint8Array(update);
        console.log(`[CRDT] APPLY REMOTE file=${filepath}`);
        Y.applyUpdate(ydocRef.current, updateUint8, 'remote');
      } catch (err) {
        console.error('[CRDT] Error applying remote update:', err);
      }
    };

    socket.on('crdt:remote_update', handleRemoteUpdate);

    // 6. Cleanup on file switch, tab close, or unmount
    return () => {
      console.log(`[CRDT] LEAVE/CLEANUP file=${filepath}`);
      socket.off('crdt:remote_update', handleRemoteUpdate);
      ydoc.off('update', handleYdocUpdate);
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      ydoc.destroy();
      ydocRef.current = null;
    };
  }, [editor, monaco, filepath, roomId, socket, readOnly]);
}
