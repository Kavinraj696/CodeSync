const { io } = require('socket.io-client');

async function testTerminalSocket() {
  console.log('[Test Script] Connecting to ws://localhost:5000/terminal...');
  const socket = io('http://localhost:5000/terminal', {
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[Test Script] Socket connected! ID:', socket.id);

    console.log('[Test Script] Emitting terminal:start for roomId: test-room...');
    socket.emit('terminal:start', { roomId: 'test-room', cols: 80, rows: 24, language: 'javascript' }, (response) => {
      console.log('[Test Script] terminal:start response:', response);

      if (response && response.success) {
        const { terminalId } = response.data;
        console.log(`[Test Script] Terminal session established! ID: ${terminalId}`);

        // Listen for output from Docker container pty
        socket.on('terminal:output', (payload) => {
          if (payload.terminalId === terminalId) {
            console.log('[Test Script RECEIVED OUTPUT]:', JSON.stringify(payload.data));
          }
        });

        // Listen for exit
        socket.on('terminal:exit', (payload) => {
          console.log('[Test Script TERMINAL EXIT]:', payload);
          socket.disconnect();
          process.exit(0);
        });

        // Send shell command: echo "Hello from CodeSync Terminal" and exit
        setTimeout(() => {
          console.log('[Test Script] Sending command: echo "Hello CodeSync Terminal"\r');
          socket.emit('terminal:input', { terminalId, data: 'echo "Hello CodeSync Terminal"\r' });
        }, 1500);

        setTimeout(() => {
          console.log('[Test Script] Sending command: exit\r');
          socket.emit('terminal:input', { terminalId, data: 'exit\r' });
        }, 3000);
      } else {
        console.error('[Test Script] Failed to start terminal:', response ? response.error : 'No response');
        socket.disconnect();
        process.exit(1);
      }
    });
  });

  socket.on('connect_error', (err) => {
    console.error('[Test Script] Connection error:', err.message);
    process.exit(1);
  });
}

testTerminalSocket();
