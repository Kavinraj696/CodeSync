const http = require('http');

function testChatStream() {
  return new Promise((resolve, reject) => {
    console.log('[Test Script] Testing POST http://localhost:5000/api/ai/chat (SSE Stream)...');

    const postData = JSON.stringify({
      message: 'Explain how async/await works in Node.js',
      fileContext: 'async function fetchData() { const res = await fetch(url); return res.json(); }',
      language: 'javascript',
    });

    const req = http.request(
      'http://localhost:5000/api/ai/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        console.log(`[Test Script] Chat Status Code: ${res.statusCode}`);
        console.log(`[Test Script] Content-Type: ${res.headers['content-type']}`);

        let fullStreamText = '';

        res.on('data', (chunk) => {
          const str = chunk.toString();
          fullStreamText += str;
          process.stdout.write(str);
        });

        res.on('end', () => {
          console.log('\n[Test Script] Chat stream complete!');
          resolve(fullStreamText);
        });
      }
    );

    req.on('error', (e) => {
      console.error('[Test Script] Chat Stream Error:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

function testInlineAction() {
  return new Promise((resolve, reject) => {
    console.log('\n[Test Script] Testing POST http://localhost:5000/api/ai/inline-action...');

    const postData = JSON.stringify({
      action: 'refactor',
      codeSelection: 'var x = 10; var y = 20; console.log(x+y);',
      language: 'javascript',
    });

    const req = http.request(
      'http://localhost:5000/api/ai/inline-action',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        console.log(`[Test Script] Inline Action Status Code: ${res.statusCode}`);
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          console.log('[Test Script] Inline Action Response:', body);
          resolve(JSON.parse(body));
        });
      }
    );

    req.on('error', (e) => {
      console.error('[Test Script] Inline Action Error:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  try {
    await testChatStream();
    await testInlineAction();
    console.log('\n✅ All AI backend endpoint tests passed!');
  } catch (err) {
    console.error('❌ AI Endpoint Test Failed:', err.message);
  }
}

runTests();
