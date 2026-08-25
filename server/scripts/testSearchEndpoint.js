const http = require('http');

function testSearch() {
  return new Promise((resolve, reject) => {
    console.log('[Test Script] Testing GET http://localhost:5000/api/workspaces/test-room/search?q=CodeSync...');

    http.get('http://localhost:5000/api/workspaces/test-room/search?q=CodeSync', (res) => {
      console.log(`[Test Script] Search Status Code: ${res.statusCode}`);

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('[Test Script] Search Results:', JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.error('[Test Script] Failed to parse JSON response:', data);
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

testSearch().then(() => {
  console.log('\n✅ Search API endpoint verified successfully!');
}).catch((err) => {
  console.error('❌ Search Test Failed:', err.message);
});
