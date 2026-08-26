import { useState, useCallback } from 'react';
import { getMonacoLanguage } from '../components/Editor/CodeEditor';

/**
 * Custom hook managing Monaco Editor settings, theme, and cursor state
 */
export function useMonacoEditor(initialSettings = {}) {
  const [fontSize, setFontSize] = useState(initialSettings.fontSize || 14);
  const [tabSize, setTabSize] = useState(initialSettings.tabSize || 2);
  const [wordWrap, setWordWrap] = useState(initialSettings.wordWrap || 'on');
  const [theme, setTheme] = useState(initialSettings.theme || 'vs-dark');
  const [cursorPos, setCursorPos] = useState({ lineNumber: 1, columnNumber: 1 });

  const updateCursorPosition = useCallback((pos) => {
    if (pos && typeof pos.lineNumber === 'number') {
      setCursorPos(pos);
    }
  }, []);

  return {
    fontSize,
    setFontSize,
    tabSize,
    setTabSize,
    wordWrap,
    setWordWrap,
    theme,
    setTheme,
    cursorPos,
    updateCursorPosition,
    getMonacoLanguage,
  };
}
