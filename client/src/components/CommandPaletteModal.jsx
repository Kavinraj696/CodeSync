import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ChevronRight, X } from 'lucide-react';

const COMMANDS = [
  { id: 'start-container', label: 'Docker: Start Sandbox Container', category: 'Container' },
  { id: 'stop-container', label: 'Docker: Stop Sandbox Container', category: 'Container' },
  { id: 'open-ai', label: 'View: Toggle AI Assistant Panel', category: 'View' },
  { id: 'open-search', label: 'View: Toggle File Search Panel', category: 'View' },
  { id: 'open-git', label: 'View: Toggle Source Control Panel', category: 'View' },
  { id: 'open-settings', label: 'Preferences: Open User Settings', category: 'Preferences' },
  { id: 'ai-explain', label: 'AI: Explain Active File Code', category: 'AI Assistant' },
  { id: 'ai-fix', label: 'AI: Fix Bugs in Active File', category: 'AI Assistant' },
  { id: 'ai-refactor', label: 'AI: Refactor Active File Code', category: 'AI Assistant' },
  { id: 'ai-tests', label: 'AI: Generate Unit Tests', category: 'AI Assistant' },
  { id: 'ai-comments', label: 'AI: Add JSDoc / Comments', category: 'AI Assistant' },
];

export default function CommandPaletteModal({ isOpen, onClose, onExecuteCommand }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const filteredCommands = React.useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (cmd) => cmd.label.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        onExecuteCommand(filteredCommands[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-modal-overlay" onClick={onClose}>
      <div className="command-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="command-input-bar">
          <Command size={16} className="brand-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-search-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="command-shortcut-hint">Esc to exit</span>
        </div>

        <div className="command-list-results">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                className={`command-item-row ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onExecuteCommand(cmd.id);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="command-item-main">
                  <ChevronRight size={14} className="cmd-arrow" />
                  <span className="cmd-label">{cmd.label}</span>
                </div>
                <span className="cmd-cat-badge">{cmd.category}</span>
              </div>
            ))
          ) : (
            <div className="command-empty">No matching commands found</div>
          )}
        </div>
      </div>
    </div>
  );
}
