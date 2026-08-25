import React, { useState } from 'react';
import TerminalTab from './TerminalTab';
import { Terminal, Plus, X, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';

export default function TerminalPanel({ roomId, language = 'javascript', runCommandTrigger, userRole = 'editor' }) {
  const [tabs, setTabs] = useState([{ id: 'term-1', name: 'Terminal 1' }]);
  const [activeTabId, setActiveTabId] = useState('term-1');
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const addTab = () => {
    const newId = `term-${Date.now()}`;
    const newTab = { id: newId, name: `Terminal ${tabs.length + 1}` };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (tabIdToClose, e) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      // Don't close the last remaining tab, just clear it or collapse
      return;
    }

    const nextTabs = tabs.filter((t) => t.id !== tabIdToClose);
    setTabs(nextTabs);

    if (activeTabId === tabIdToClose) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  return (
    <div
      className="terminal-panel"
      style={{
        height: collapsed ? '36px' : maximized ? '70vh' : '260px',
        transition: 'height 0.2s ease',
      }}
    >
      {/* Terminal Panel Top Bar */}
      <div className="terminal-bar">
        <div className="terminal-tabs">
          <div className="terminal-label">
            <Terminal size={14} className="brand-icon" />
            <span>TERMINAL</span>
          </div>

          {!collapsed &&
            tabs.map((tab) => (
              <div
                key={tab.id}
                className={`terminal-tab-button ${tab.id === activeTabId ? 'active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span>{tab.name}</span>
                {tabs.length > 1 && (
                  <X
                    size={12}
                    className="tab-close-icon"
                    onClick={(e) => closeTab(tab.id, e)}
                  />
                )}
              </div>
            ))}

          {!collapsed && (
            <button className="new-tab-btn" onClick={addTab} title="New Terminal Session">
              <Plus size={14} />
            </button>
          )}
        </div>

        <div className="panel-controls">
          <button
            className="panel-ctrl-btn"
            onClick={() => setMaximized(!maximized)}
            title={maximized ? 'Restore Size' : 'Maximize Panel'}
          >
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            className="panel-ctrl-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand Terminal' : 'Collapse Terminal'}
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Terminal Tab Body Container */}
      {!collapsed && (
        <div className="terminal-body">
          {tabs.map((tab) => (
            <TerminalTab
              key={tab.id}
              roomId={roomId}
              tabId={tab.id}
              isActive={tab.id === activeTabId}
              language={language}
              runCommandTrigger={runCommandTrigger}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}
