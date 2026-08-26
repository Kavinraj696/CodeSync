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
  value,
  onChange,
  onCursorMove,
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

  const language = getMonacoLanguage(filepath);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure editor keybindings (Phase 5)
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

    // Track local cursor movement & selections for real-time collaboration presence
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

    // Setup Yjs CRDT update vectors over Socket.IO if socket is active
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
    if (onChange && !readOnly) {
      onChange(newValue || '');
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
