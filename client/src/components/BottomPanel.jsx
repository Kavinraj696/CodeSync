import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Terminal as TerminalIcon, FileText, Bug } from 'lucide-react';
import TerminalTab from './TerminalTab';

export default function BottomPanel({
  roomId,
  runCommandTrigger,
  outputLogs = [],
  problems = [],
  onSelectProblem,
  userRole = 'editor',
}) {
  const [activeTab, setActiveTab] = useState('terminal'); // 'problems' | 'output' | 'terminal' | 'debug'

  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const warningCount = problems.filter((p) => p.severity === 'warning').length;

  return (
    <div
      style={{
        height: '240px',
        backgroundColor: '#181818',
        borderTop: '1px solid #2d2d2d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Bottom Panel Header Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#252526',
          borderBottom: '1px solid #2d2d2d',
          padding: '0 8px',
          height: '32px',
          userSelect: 'none',
        }}
      >
        {/* Problems Tab */}
        <button
          style={{
            background: activeTab === 'problems' ? '#1e1e1e' : 'transparent',
            border: 'none',
            borderTop: activeTab === 'problems' ? '2px solid #007acc' : '2px solid transparent',
            color: activeTab === 'problems' ? '#ffffff' : '#969696',
            padding: '4px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: activeTab === 'problems' ? '600' : 'normal',
          }}
          onClick={() => setActiveTab('problems')}
        >
          <AlertCircle size={13} color={errorCount > 0 ? '#f48771' : '#969696'} />
          <span>PROBLEMS</span>
          {(errorCount > 0 || warningCount > 0) && (
            <span
              style={{
                fontSize: '10px',
                background: errorCount > 0 ? '#f48771' : '#cca700',
                color: '#1e1e1e',
                borderRadius: '8px',
                padding: '1px 6px',
                fontWeight: 'bold',
              }}
            >
              {errorCount + warningCount}
            </span>
          )}
        </button>

        {/* Output Tab */}
        <button
          style={{
            background: activeTab === 'output' ? '#1e1e1e' : 'transparent',
            border: 'none',
            borderTop: activeTab === 'output' ? '2px solid #007acc' : '2px solid transparent',
            color: activeTab === 'output' ? '#ffffff' : '#969696',
            padding: '4px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: activeTab === 'output' ? '600' : 'normal',
          }}
          onClick={() => setActiveTab('output')}
        >
          <FileText size={13} color="#969696" />
          <span>OUTPUT</span>
        </button>

        {/* Terminal Tab */}
        <button
          style={{
            background: activeTab === 'terminal' ? '#1e1e1e' : 'transparent',
            border: 'none',
            borderTop: activeTab === 'terminal' ? '2px solid #007acc' : '2px solid transparent',
            color: activeTab === 'terminal' ? '#ffffff' : '#969696',
            padding: '4px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: activeTab === 'terminal' ? '600' : 'normal',
          }}
          onClick={() => setActiveTab('terminal')}
        >
          <TerminalIcon size={13} color="#007acc" />
          <span>TERMINAL</span>
        </button>

        {/* Debug Console Tab */}
        <button
          style={{
            background: activeTab === 'debug' ? '#1e1e1e' : 'transparent',
            border: 'none',
            borderTop: activeTab === 'debug' ? '2px solid #007acc' : '2px solid transparent',
            color: activeTab === 'debug' ? '#ffffff' : '#969696',
            padding: '4px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: activeTab === 'debug' ? '600' : 'normal',
          }}
          onClick={() => setActiveTab('debug')}
        >
          <Bug size={13} color="#969696" />
          <span>DEBUG CONSOLE</span>
        </button>
      </div>

      {/* Tab Body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Problems View */}
        {activeTab === 'problems' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
            {problems.length === 0 ? (
              <div style={{ color: '#858585', fontStyle: 'italic' }}>No problems detected in workspace.</div>
            ) : (
              problems.map((prob, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    borderBottom: '1px solid #252526',
                  }}
                  onClick={() => onSelectProblem && onSelectProblem(prob)}
                >
                  {prob.severity === 'error' ? (
                    <AlertCircle size={14} color="#f48771" />
                  ) : prob.severity === 'warning' ? (
                    <AlertTriangle size={14} color="#cca700" />
                  ) : (
                    <Info size={14} color="#75beff" />
                  )}
                  <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{prob.filepath}</span>
                  <span style={{ color: '#858585' }}>
                    [{prob.lineNumber}:{prob.columnNumber}]
                  </span>
                  <span style={{ color: '#cccccc', flex: 1 }}>{prob.message}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Output View */}
        {activeTab === 'output' && (
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '10px',
              backgroundColor: '#1e1e1e',
              color: '#4ec9b0',
              fontFamily: 'Fira Code, monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {outputLogs.length === 0 ? (
              <div style={{ color: '#858585', fontStyle: 'italic' }}>[CodeSync Output Channel Ready]</div>
            ) : (
              outputLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '4px' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        )}

        {/* Terminal View */}
        {activeTab === 'terminal' && (
          <div style={{ height: '100%', width: '100%' }}>
            <TerminalTab
              roomId={roomId}
              runCommandTrigger={runCommandTrigger}
              userRole={userRole}
            />
          </div>
        )}

        {/* Debug Console View */}
        {activeTab === 'debug' && (
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '10px',
              backgroundColor: '#1e1e1e',
              color: '#ce9178',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}
          >
            <div style={{ color: '#858585', fontStyle: 'italic' }}>
              Debug console idle. Execute your program to stream runtime debug evaluation logs.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
