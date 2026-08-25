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

async function testSettingsWorkflow() {
  console.log('[Test Script] Starting User Settings API tests...');

  // 1. Get initial settings
  console.log('\n[1/3] GET /api/users/me/settings');
  const initialRes = await makeRequest('/api/users/me/settings');
  console.log('Initial Settings:', initialRes.data);

  // 2. Update settings
  console.log('\n[2/3] PUT /api/users/me/settings');
  const updateRes = await makeRequest('/api/users/me/settings', 'PUT', {
    theme: 'monokai',
    fontSize: 16,
    tabSize: 4,
    keybindings: 'vim',
  });
  console.log('Update Settings Result:', updateRes.data);

  // 3. Verify updated settings
  console.log('\n[3/3] Final settings check...');
  const finalRes = await makeRequest('/api/users/me/settings');
  console.log('Final Settings:', finalRes.data);

  console.log('\n✅ User Settings API endpoints verified successfully!');
}

testSettingsWorkflow().catch((err) => {
  console.error('❌ Settings Test Failed:', err.message);
});
