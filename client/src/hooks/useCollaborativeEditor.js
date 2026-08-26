import { useEffect, useRef } from 'react';
import * as Y from 'yjs';

/**
 * Custom hook managing Yjs CRDT document lifecycle & Monaco Editor binding.
 * Serves as the single source of truth for real-time collaborative text editing.
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

  useEffect(() => {
    if (!editor || !monaco || !filepath || !roomId || !socket) return;

    // 1. Create file-scoped Y.Doc
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ytext = ydoc.getText('monaco');

    const monacoModel = editor.getModel();
    if (!monacoModel) return;

    // 2. Initial document content seeding
    // Populate Y.Text only if it is completely empty
    if (ytext.length === 0 && initialValue) {
      ydoc.transact(() => {
        ytext.insert(0, initialValue);
      }, 'init');
    }

    // Set Monaco model initial text from Y.Text if Y.Text has content
    if (ytext.length > 0) {
      const yval = ytext.toString();
      if (monacoModel.getValue() !== yval) {
        monacoModel.setValue(yval);
      }
    }

    // 3. Mutex flag to prevent echo loops during edit application
    let isApplyingRemote = false;

    // 4. Monaco -> Y.Text change handler
    const monacoChangeDisposable = monacoModel.onDidChangeContent((event) => {
      if (isApplyingRemote || readOnly) return;

      ydoc.transact(() => {
        // Apply Monaco changes right to left to keep character offsets stable
        const sortedChanges = [...event.changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
        for (const change of sortedChanges) {
          if (change.rangeLength > 0) {
            ytext.delete(change.rangeOffset, change.rangeLength);
          }
          if (change.text.length > 0) {
            ytext.insert(change.rangeOffset, change.text);
          }
        }
      }, 'local-monaco');
    });

    // 5. Y.Text -> Monaco change observer
    const ytextObserver = (event) => {
      // Ignore edits originating from local Monaco typing
      if (event.transaction.origin === 'local-monaco') return;

      isApplyingRemote = true;
      try {
        let index = 0;
        const edits = [];
        for (const op of event.delta) {
          if (op.retain !== undefined) {
            index += op.retain;
          } else if (op.insert !== undefined) {
            const insertStr = typeof op.insert === 'string' ? op.insert : '';
            const pos = monacoModel.getPositionAt(index);
            edits.push({
              range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
              text: insertStr,
              forceMoveMarkers: true,
            });
            index += insertStr.length;
          } else if (op.delete !== undefined) {
            const pos = monacoModel.getPositionAt(index);
            const endPos = monacoModel.getPositionAt(index + op.delete);
            edits.push({
              range: new monaco.Range(pos.lineNumber, pos.column, endPos.lineNumber, endPos.column),
              text: '',
              forceMoveMarkers: true,
            });
          }
        }
        if (edits.length > 0) {
          monacoModel.applyEdits(edits);
        }
      } finally {
        isApplyingRemote = false;
      }
    };

    ytext.observe(ytextObserver);

    // 6. Y.Doc update listener -> Socket.IO emit
    const ydocUpdateHandler = (update, origin) => {
      // Do NOT re-emit updates received from remote socket
      if (origin === 'remote' || readOnly) return;

      const updateArray = Array.from(update);
      socket.emit('crdt:update', {
        roomId,
        filepath,
        update: updateArray,
      });
    };

    ydoc.on('update', ydocUpdateHandler);

    // 7. Socket.IO remote update listener
    const handleRemoteUpdate = ({ filepath: incomingPath, update, roomId: incomingRoomId }) => {
      if (incomingPath !== filepath) return;
      if (incomingRoomId && incomingRoomId !== roomId) return;
      if (!update || !ydocRef.current) return;

      try {
        const updateUint8 = new Uint8Array(update);
        Y.applyUpdate(ydocRef.current, updateUint8, 'remote');
      } catch (err) {
        console.error('[Yjs] Error applying remote update:', err);
      }
    };

    socket.on('crdt:remote_update', handleRemoteUpdate);

    // 8. Cleanup on file switch, tab close, or component unmount
    return () => {
      socket.off('crdt:remote_update', handleRemoteUpdate);
      ydoc.off('update', ydocUpdateHandler);
      ytext.unobserve(ytextObserver);
      monacoChangeDisposable.dispose();
      ydoc.destroy();
      ydocRef.current = null;
    };
  }, [editor, monaco, filepath, roomId, socket, readOnly]);
}
