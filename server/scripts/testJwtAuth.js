const http = require('http');

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

async function testJwtWorkflow() {
  console.log('[Test Script] Starting JWT Authentication tests...\n');

  const testUser = {
    username: `dev_user_${Date.now()}`,
    email: `dev_${Date.now()}@codesync.dev`,
    password: 'secure_password_123',
  };

  // 1. Register
  console.log('[1/3] Testing POST /api/auth/register...');
  const regRes = await makeRequest('/api/auth/register', 'POST', testUser);
  console.log('Register Status:', regRes.statusCode);
  console.log('Register Result:', regRes.data);

  if (regRes.statusCode !== 201 || !regRes.data.data?.token) {
    console.error('Register failed response:', regRes);
    throw new Error('Registration failed!');
  }

  const token = regRes.data.data.token;

  // 2. Login
  console.log('\n[2/3] Testing POST /api/auth/login...');
  const loginRes = await makeRequest('/api/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password,
  });
  console.log('Login Status:', loginRes.statusCode);
  console.log('Login Result:', loginRes.data);

  if (loginRes.statusCode !== 200 || !loginRes.data.data?.token) {
    throw new Error('Login failed!');
  }

  // 3. Get Protected Profile (/api/auth/me)
  console.log('\n[3/3] Testing Protected GET /api/auth/me...');
  const meRes = await makeRequest('/api/auth/me', 'GET', null, token);
  console.log('Profile Status:', meRes.statusCode);
  console.log('Profile Result:', meRes.data);

  if (meRes.statusCode === 200 && meRes.data.data?.email === testUser.email) {
    console.log('\n✅ JWT Authentication & Authorization fully verified!');
  } else {
    throw new Error('Protected route verification failed!');
  }
}

testJwtWorkflow().catch((err) => {
  console.error('❌ JWT Test Error:', err.message);
  process.exit(1);
});
