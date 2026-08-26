import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useCollaborativeEditor } from '../../hooks/useCollaborativeEditor';

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
  const [editorInstance, setEditorInstance] = useState(null);
  const [monacoInstance, setMonacoInstance] = useState(null);
  const decorationsRef = useRef([]);

  const language = getMonacoLanguage(filepath);

  // Yjs CRDT Collaboration Hook - Single Source of Truth
  useCollaborativeEditor({
    editor: editorInstance,
    monaco: monacoInstance,
    filepath,
    roomId,
    socket,
    initialValue: value,
    readOnly,
    onContentChange: onChange,
  });

  // Render team members' remote cursors overlay in Monaco Editor
  useEffect(() => {
    if (!editorInstance || !monacoInstance) return;
    const editor = editorInstance;
    const monaco = monacoInstance;

    const currentUserId = String(currentUser?._id || currentUser?.id || '');
    const activeRemoteCursors = Object.values(remoteCursors || {}).filter(
      (c) => String(c.userId || c.id) !== currentUserId && (!c.filepath || c.filepath === filepath)
    );

    const newDecorations = activeRemoteCursors.map((c) => {
      const line = Math.max(1, c.lineNumber || 1);
      const col = Math.max(1, c.columnNumber || 1);
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

    return () => {
      if (editorInstance && decorationsRef.current.length > 0) {
        decorationsRef.current = editorInstance.deltaDecorations(decorationsRef.current, []);
      }
    };
  }, [remoteCursors, filepath, currentUser, editorInstance, monacoInstance]);

  const handleEditorDidMount = (editor, monaco) => {
    setEditorInstance(editor);
    setMonacoInstance(monaco);

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

    // Track local cursor position & selection movement for presence overlay
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
  };

  const handleEditorChange = (newValue) => {
    const val = newValue || '';
    if (onChange && !readOnly) {
      onChange(val);
    }
  };

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      <Editor
        height="100%"
        width="100%"
        language={language}
        defaultValue={value}
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
