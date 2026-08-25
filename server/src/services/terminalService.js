const pty = require('node-pty');
const fs = require('fs');
const path = require('path');
const containerService = require('./containerService');
const Workspace = require('../models/Workspace');

// Map of active terminal sessions: terminalId -> { terminalId, roomId, socketId, ptyProcess }
const activeTerminals = new Map();

/**
 * Finds the absolute path to docker.exe on Windows if not in default PATH
 */
function getDockerExecutablePath() {
  const localAppData = process.env.LOCALAPPDATA || 'C:\\Users\\kavin\\AppData\\Local';
  const candidatePaths = [
    path.join(localAppData, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    'docker.exe',
    'docker',
  ];

  for (const p of candidatePaths) {
    if (p === 'docker' || p === 'docker.exe') return p;
    if (fs.existsSync(p)) {
      console.log(`[TerminalService] Resolved Docker executable path: ${p}`);
      return p;
    }
  }

  return 'docker';
}

/**
 * Creates a new pseudo-terminal session attached to a workspace Docker container
 */
async function createTerminalSession(socket, { roomId, cols = 80, rows = 24, language = 'javascript' }) {
  if (!roomId) {
    throw new Error('roomId is required to create a terminal session');
  }

  // 1. Ensure workspace Docker container is active and running
  console.log(`[TerminalService] Ensuring container for workspace '${roomId}' is running...`);
  await containerService.startWorkspaceContainer(roomId, language);

  let projName = 'workspace';
  try {
    const doc = await Workspace.findOne({ roomId });
    if (doc && doc.name) {
      projName = doc.name;
    } else if (roomId.startsWith('proj-')) {
      const parts = roomId.split('-');
      if (parts.length >= 2) projName = parts[1];
    }
  } catch (e) {
    if (roomId.startsWith('proj-')) {
      const parts = roomId.split('-');
      if (parts.length >= 2) projName = parts[1];
    }
  }

  const containerName = `codesync-ws-${roomId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const terminalId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const dockerExe = getDockerExecutablePath();

  console.log(`[TerminalService] Spawning pty process using '${dockerExe}' for container '${containerName}' (ID: ${terminalId})...`);

  // 2. Spawn pty running docker exec -it <containerName> sh
  const ptyProcess = pty.spawn(dockerExe, ['exec', '-it', containerName, 'sh'], {
    name: 'xterm-color',
    cols: parseInt(cols, 10) || 80,
    rows: parseInt(rows, 10) || 24,
    cwd: process.env.HOME || process.env.USERPROFILE || 'C:\\',
    env: process.env,
    useConpty: false,
  });

  // 3. Set clean terminal prompt displaying /projectName/folderName$
  setTimeout(() => {
    try {
      ptyProcess.write(`export HISTFILE=/dev/null; rm -f /root/.ash_history /root/.bash_history 2>/dev/null; export PS1="/${projName}\\\${PWD#/root}$ "\nclear\n`);
    } catch (err) {}
  }, 200);

  // 4. Pipe pty data output -> Socket.IO event 'terminal:output'
  ptyProcess.onData((data) => {
    socket.emit('terminal:output', { terminalId, data });
  });

  // 5. Handle pty process exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`[TerminalService] PTY process ${terminalId} exited (code: ${exitCode}, signal: ${signal})`);
    socket.emit('terminal:exit', { terminalId, code: exitCode });
    activeTerminals.delete(terminalId);
  });

  // 6. Store active session
  activeTerminals.set(terminalId, {
    terminalId,
    roomId,
    socketId: socket.id,
    ptyProcess,
  });

  console.log(`[TerminalService] Terminal session ${terminalId} created successfully.`);

  return { terminalId, roomId, status: 'started' };
}

/**
 * Write keystrokes / input data to the PTY process
 */
function handleTerminalInput(terminalId, data) {
  const session = activeTerminals.get(terminalId);
  if (session && session.ptyProcess) {
    session.ptyProcess.write(data);
  } else {
    console.warn(`[TerminalService] Terminal input ignored: session ${terminalId} not found`);
  }
}

/**
 * Resize the PTY terminal window
 */
function handleTerminalResize(terminalId, cols, rows) {
  const session = activeTerminals.get(terminalId);
  if (session && session.ptyProcess) {
    try {
      const validCols = Math.max(1, parseInt(cols, 10) || 80);
      const validRows = Math.max(1, parseInt(rows, 10) || 24);
      session.ptyProcess.resize(validCols, validRows);
    } catch (err) {
      console.error(`[TerminalService] Error resizing terminal ${terminalId}:`, err.message);
    }
  }
}

/**
 * Close a specific terminal session
 */
function closeTerminalSession(terminalId) {
  const session = activeTerminals.get(terminalId);
  if (session) {
    try {
      session.ptyProcess.kill();
    } catch (err) {
      // Process already terminated
    }
    activeTerminals.delete(terminalId);
    console.log(`[TerminalService] Terminal session ${terminalId} closed.`);
  }
}

/**
 * Cleanup all terminal sessions associated with a disconnected client socket
 */
function cleanupSocketTerminals(socketId) {
  for (const [terminalId, session] of activeTerminals.entries()) {
    if (session.socketId === socketId) {
      console.log(`[TerminalService] Cleaning up terminal ${terminalId} for socket ${socketId}...`);
      closeTerminalSession(terminalId);
    }
  }
}

module.exports = {
  createTerminalSession,
  handleTerminalInput,
  handleTerminalResize,
  closeTerminalSession,
  cleanupSocketTerminals,
};
