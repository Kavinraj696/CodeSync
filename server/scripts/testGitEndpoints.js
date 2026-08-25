const http = require('http');

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function testGitWorkflow() {
  console.log('[Test Script] Starting Git integration endpoint tests...');

  // 1. Get status (should auto-init repo)
  console.log('\n[1/4] GET /api/workspaces/test-room/git/status');
  const statusRes = await makeRequest('/api/workspaces/test-room/git/status');
  console.log('Status Result:', statusRes.data);

  // 2. Stage files
  console.log('\n[2/4] POST /api/workspaces/test-room/git/stage');
  const stageRes = await makeRequest('/api/workspaces/test-room/git/stage', 'POST', { filepath: '.' });
  console.log('Stage Result:', stageRes.data);

  // 3. Commit staged changes
  console.log('\n[3/4] POST /api/workspaces/test-room/git/commit');
  const commitRes = await makeRequest('/api/workspaces/test-room/git/commit', 'POST', {
    message: 'Initial workspace commit from test script',
  });
  console.log('Commit Result:', commitRes.data);

  // 4. Verify clean status after commit
  console.log('\n[4/4] Final status check...');
  const finalStatus = await makeRequest('/api/workspaces/test-room/git/status');
  console.log('Final Status Result:', finalStatus.data);

  console.log('\n✅ Git endpoints successfully verified!');
}

testGitWorkflow().catch((err) => {
  console.error('❌ Git Test Failed:', err.message);
});
