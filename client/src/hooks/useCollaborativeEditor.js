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

    console.log(`[DEBUG-CRDT] JOIN workspace=${roomId} file=${filepath}`);

    // 1. Create file-scoped Y.Doc
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ytext = ydoc.getText('monaco');

    const monacoModel = editor.getModel();
    if (!monacoModel) return;

    // 2. Bind Monaco Model to Y.Text using official y-monaco MonacoBinding
    const binding = new MonacoBinding(
      ytext,
      monacoModel,
      new Set([editor])
    );
    bindingRef.current = binding;

    // 3. Request current server-side Yjs document state (Step 12)
    console.log(`[DEBUG-CRDT] REQUEST_DOC_STATE roomId=${roomId} file=${filepath}`);
    socket.emit('crdt:doc_request', { roomId, filepath });

    // Handle server initial Yjs document response
    const handleDocResponse = ({ filepath: incomingPath, update }) => {
      if (incomingPath !== filepath || !ydocRef.current) return;

      if (update && update.length > 0) {
        console.log(`[DEBUG-CRDT] INIT_SERVER_DOC file=${filepath} bytes=${update.length}`);
        try {
          Y.applyUpdate(ydocRef.current, new Uint8Array(update), 'init-server');
        } catch (err) {
          console.error('[DEBUG-CRDT] Error applying init-server update:', err);
        }
      }

      // If document is still empty after server response and initialValue exists, seed locally
      if (ytext.length === 0 && initialValue) {
        console.log(`[DEBUG-CRDT] INIT_LOCAL_DOC_SEED file=${filepath} len=${initialValue.length}`);
        ydocRef.current.transact(() => {
          ytext.insert(0, initialValue);
        }, 'init-local');
      }

      console.log(`[DEBUG-CRDT] DOC_READY file=${filepath} ytextLen=${ytext.length} monacoLen=${monacoModel.getValue().length}`);
    };

    socket.on('crdt:doc_response', handleDocResponse);

    // 4. Listen for local Y.Doc updates and broadcast over Socket.IO
    const handleYdocUpdate = (update, origin) => {
      // Do NOT re-emit updates received from remote sockets or initial server sync
      if (origin === 'remote' || origin === 'init-server' || readOnly) return;

      const updateArray = Array.from(update);
      console.log(`[DEBUG-CRDT] MONACO_CHANGE file=${filepath} length=${monacoModel.getValue().length}`);
      console.log(`[DEBUG-CRDT] YDOC_UPDATE file=${filepath} origin=${origin} bytes=${updateArray.length}`);
      console.log(`[DEBUG-CRDT] SOCKET_SEND roomId=${roomId} file=${filepath} bytes=${updateArray.length}`);

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

      console.log(`[DEBUG-CRDT] SOCKET_RECEIVE roomId=${roomId} file=${filepath} bytes=${update.length}`);
      console.log(`[DEBUG-CRDT] APPLY_UPDATE file=${filepath}`);
      try {
        const updateUint8 = new Uint8Array(update);
        Y.applyUpdate(ydocRef.current, updateUint8, 'remote');
        console.log(`[DEBUG-CRDT] APPLY_COMPLETE file=${filepath} ytextLength=${ytext.length}`);
        console.log(`[DEBUG-CRDT] AFTER_REMOTE_UPDATE file=${filepath}`, {
          ytext: ytext.toString(),
          editor: monacoModel.getValue(),
        });

        // Verification check
        if (ytext.toString() !== monacoModel.getValue()) {
          console.error('[DEBUG-CRDT] MISMATCH_ERROR! Y.Text does not match Monaco model!', {
            ytext: ytext.toString(),
            monaco: monacoModel.getValue(),
          });
        }
      } catch (err) {
        console.error('[DEBUG-CRDT] Error applying remote update:', err);
      }
    };

    socket.on('crdt:remote_update', handleRemoteUpdate);

    // 6. Cleanup on file switch, tab close, or unmount
    return () => {
      console.log(`[DEBUG-CRDT] LEAVE/CLEANUP file=${filepath}`);
      socket.off('crdt:doc_response', handleDocResponse);
      socket.off('crdt:remote_update', handleRemoteUpdate);
      ydoc.off('update', handleYdocUpdate);
      if (bindingRef.current) {
        try {
          bindingRef.current.destroy();
        } catch (err) {
          console.error('[DEBUG-CRDT] Error destroying binding:', err);
        }
        bindingRef.current = null;
      }
      try {
        ydoc.destroy();
      } catch (err) {
        console.error('[DEBUG-CRDT] Error destroying ydoc:', err);
      }
      ydocRef.current = null;
    };
  }, [editor, monaco, filepath, roomId, socket, readOnly]);
}
