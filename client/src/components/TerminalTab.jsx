import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

export default function TerminalTab({ roomId, tabId, isActive, language = 'javascript', runCommandTrigger, userRole = 'editor' }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const terminalIdRef = useRef(null);
  const pendingCommandRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const isViewer = userRole === 'viewer';

  // Listen for programmatic runCommandTrigger from Run Code button
  useEffect(() => {
    if (isViewer) return;
    if (runCommandTrigger && runCommandTrigger.command && isActive) {
      const cmdStr = `${runCommandTrigger.command}\r`;
      if (socketRef.current && terminalIdRef.current) {
        socketRef.current.emit('terminal:input', {
          terminalId: terminalIdRef.current,
          data: cmdStr,
        });
        if (xtermRef.current) xtermRef.current.focus();
      } else {
        pendingCommandRef.current = cmdStr;
      }
    }
  }, [runCommandTrigger, isActive, isViewer]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // 1. Initialize xterm.js instance & FitAddon
    const term = new Terminal({
      cursorBlink: !isViewer,
      fontSize: 13,
      fontFamily: "'Fira Code', Consolas, monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: isViewer ? 'transparent' : '#ffffff',
        selectionBackground: '#264f78',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    let isDisposed = false;

    // Defer xterm opening until container element dimensions are layout-computed
    const timer = setTimeout(() => {
      if (isDisposed || !terminalRef.current) return;
      try {
        term.open(terminalRef.current);
        if (terminalRef.current.clientWidth > 0) {
          fitAddon.fit();
        }
        term.write('\x1b[36m🚀 Connecting to CodeSync workspace terminal...\x1b[0m\r\n');
        if (isViewer) {
          term.write('\x1b[33m🔒 Viewer Permission Active (Terminal is Read-Only)\x1b[0m\r\n');
        }
      } catch (err) {}
    }, 50);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // 2. Connect to Socket.IO /terminal namespace
    const socketHost = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
    const socket = io(`${socketHost}/terminal`, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);

      const cols = term.cols || 80;
      const rows = term.rows || 24;

      // Start terminal session on backend
      socket.emit('terminal:start', { roomId, cols, rows, language }, (response) => {
        if (response && response.success) {
          terminalIdRef.current = response.data.terminalId;
          try {
            term.clear();
            if (isViewer) {
              term.writeln('\x1b[33m🔒 Read-Only Viewer Session (Keystrokes Disabled)\x1b[0m\r\n');
            } else {
              term.focus();
            }
          } catch (e) {}

          // Execute any queued command from Run Code button
          if (pendingCommandRef.current && !isViewer) {
            socket.emit('terminal:input', {
              terminalId: terminalIdRef.current,
              data: pendingCommandRef.current,
            });
            pendingCommandRef.current = null;
          }
        } else {
          const errMessage = response ? response.error : 'Failed to establish terminal session';
          setError(errMessage);
          try {
            term.writeln(`\r\n\x1b[31m❌ Terminal Error: ${errMessage}\x1b[0m\r\n`);
          } catch (e) {}
        }
      });
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      try {
        term.writeln(`\r\n\x1b[31m❌ Socket Connection Error: ${err.message}\x1b[0m\r\n`);
      } catch (e) {}
    });

    // Handle terminal output stream
    socket.on('terminal:output', (payload) => {
      if (payload.terminalId === terminalIdRef.current) {
        try {
          term.write(payload.data);
        } catch (e) {}
      }
    });

    // Handle terminal exit event
    socket.on('terminal:exit', (payload) => {
      if (payload.terminalId === terminalIdRef.current) {
        term.writeln(`\r\n\x1b[33m⚡ Process exited with code ${payload.code}\x1b[0m\r\n`);
      }
    });

    // Handle client user keystrokes input (Disabled for viewers)
    const dataDisposable = term.onData((data) => {
      if (isViewer) return;
      if (socketRef.current && terminalIdRef.current) {
        socketRef.current.emit('terminal:input', {
          terminalId: terminalIdRef.current,
          data,
        });
      }
    });

    // Handle window resize events
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current && terminalRef.current && terminalRef.current.clientWidth > 0) {
        try {
          fitAddonRef.current.fit();
          if (socketRef.current && terminalIdRef.current) {
            socketRef.current.emit('terminal:resize', {
              terminalId: terminalIdRef.current,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            });
          }
        } catch (e) {}
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      isDisposed = true;
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      dataDisposable.dispose();

      if (socketRef.current && terminalIdRef.current) {
        socketRef.current.emit('terminal:stop', { terminalId: terminalIdRef.current });
        socketRef.current.disconnect();
      }

      try {
        term.dispose();
      } catch (e) {}
    };
  }, [roomId, tabId]);

  // Re-fit xterm when tab becomes active
  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current && terminalRef.current && terminalRef.current.clientWidth > 0) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
          xtermRef.current.focus();
          if (socketRef.current && terminalIdRef.current) {
            socketRef.current.emit('terminal:resize', {
              terminalId: terminalIdRef.current,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            });
          }
        } catch (e) {}
      }, 50);
    }
  }, [isActive]);

  return (
    <div
      style={{
        display: isActive ? 'block' : 'none',
        height: '100%',
        width: '100%',
        position: 'relative',
        backgroundColor: '#1e1e1e',
      }}
    >
      <div
        ref={terminalRef}
        style={{
          height: '100%',
          width: '100%',
          padding: '8px 12px',
        }}
      />
    </div>
  );
}
