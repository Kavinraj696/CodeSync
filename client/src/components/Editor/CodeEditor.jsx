import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';

/**
 * Maps file extensions to Monaco Editor supported languages
 */
export function getMonacoLanguage(filepath = '') {
  if (!filepath) return 'plaintext';
  const ext = filepath.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'cpp':
    case 'c':
    case 'cc':
    case 'h':
    case 'hpp':
      return 'cpp';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'rs':
      return 'rust';
    case 'rb':
      return 'ruby';
    case 'php':
      return 'php';
    case 'cs':
      return 'csharp';
    case 'dart':
      return 'dart';
    case 'kt':
    case 'kts':
      return 'kotlin';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'sql':
      return 'sql';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
}

export default function CodeEditor({
  filepath,
  value = '',
  onChange,
  onCursorMove,
  remoteCursors = {},
  currentUser,
  readOnly = false,
  fontSize = 14,
  tabSize = 2,
  wordWrap = 'on',
  theme = 'vs-dark',
  socket,
  roomId,
  onSave,
  onOpenQuickOpen,
  onOpenCommandPalette,
  onOpenSearch,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const ydocRef = useRef(null);
  const decorationsRef = useRef([]);

  const language = getMonacoLanguage(filepath);

  // Sync value changes to Monaco model when remote updates arrive
  useEffect(() => {
    if (editorRef.current) {
      const currentVal = editorRef.current.getValue();
      if (value !== undefined && value !== currentVal) {
        const position = editorRef.current.getPosition();
        editorRef.current.setValue(value);
        if (position) {
          editorRef.current.setPosition(position);
        }
      }
    }
  }, [value]);

  // Render team members' remote cursors overlay in Monaco Editor
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const currentUserId = String(currentUser?._id || currentUser?.id || '');
    const activeRemoteCursors = Object.values(remoteCursors || {}).filter(
      (c) => String(c.userId || c.id) !== currentUserId
    );

    const newDecorations = activeRemoteCursors.map((c) => {
      const line = Math.max(1, c.lineNumber || 1);
      const col = Math.max(1, c.columnNumber || 1);
      const color = c.color || '#007acc';
      return {
        range: new monaco.Range(line, col, line, col + 1),
        options: {
          className: 'monaco-remote-cursor-line',
          glyphMarginClassName: 'monaco-remote-cursor-glyph',
          linesDecorationsClassName: 'monaco-remote-cursor-gutter',
          inlineClassName: 'monaco-remote-cursor-inline',
          hoverMessage: {
            value: `👤 **${c.username || 'Collaborator'}** (Line ${line}, Col ${col})`,
          },
        },
      };
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [remoteCursors, currentUser]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure keybindings
    // Ctrl+S / Cmd+S -> Save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) onSave();
    });

    // Ctrl+P / Cmd+P -> Quick Open
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      if (onOpenQuickOpen) onOpenQuickOpen();
    });

    // Ctrl+Shift+P / Cmd+Shift+P -> Command Palette
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
      if (onOpenCommandPalette) onOpenCommandPalette();
    });

    // Ctrl+Shift+F / Cmd+Shift+F -> Search in Files
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      if (onOpenSearch) onOpenSearch();
    });

    // Track local cursor position & selection movement
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorMove) {
        const position = e.position;
        const selection = editor.getSelection();
        onCursorMove({
          lineNumber: position.lineNumber,
          columnNumber: position.column,
          selectionStart: selection ? selection.startLineNumber : position.lineNumber,
          selectionEnd: selection ? selection.endLineNumber : position.lineNumber,
        });
      }
    });

    // Setup Yjs CRDT update vectors over Socket.IO
    if (socket && roomId && filepath) {
      try {
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;
        const ytext = ydoc.getText('monaco');

        if (value && ytext.toString() !== value) {
          ytext.insert(0, value);
        }

        ydoc.on('update', (update, origin) => {
          if (origin !== 'remote') {
            socket.emit('crdt:update', {
              roomId,
              filepath,
              update: Array.from(update),
            });
          }
        });

        const handleRemoteCrdtUpdate = ({ filepath: remotePath, update }) => {
          if (remotePath === filepath && update && ydocRef.current) {
            try {
              Y.applyUpdate(ydocRef.current, new Uint8Array(update), 'remote');
            } catch (err) {}
          }
        };

        socket.on('crdt:remote_update', handleRemoteCrdtUpdate);

        return () => {
          socket.off('crdt:remote_update', handleRemoteCrdtUpdate);
          if (ydocRef.current) ydocRef.current.destroy();
        };
      } catch (e) {
        console.warn('[MonacoEditor] Yjs CRDT init:', e.message);
      }
    }
  };

  const handleEditorChange = (newValue) => {
    const val = newValue || '';
    if (onChange && !readOnly) {
      onChange(val);
    }
    // Broadcast live code change event to Socket.IO
    if (socket && roomId && filepath && !readOnly) {
      socket.emit('code:change', {
        roomId,
        filepath,
        content: val,
      });
    }
  };

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={value}
        theme={theme}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          fontSize: parseInt(fontSize, 10) || 14,
          tabSize: parseInt(tabSize, 10) || 2,
          wordWrap,
          minimap: { enabled: true },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnPaste: true,
          formatOnType: true,
          folding: true,
          renderLineHighlight: 'all',
          fontFamily: 'Fira Code, Consolas, Monaco, monospace',
        }}
      />
    </div>
  );
}
