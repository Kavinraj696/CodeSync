const https = require('https');
require('dotenv').config();

const apiKey = process.env.AI_API_KEY;

async function testGemini() {
  return new Promise((resolve) => {
    console.log('[AI Key Test] Testing Google Gemini API...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: 'Hello Gemini, reply with "OK".' }] }],
    });

    const req = https.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          console.log(`[Gemini Test Status]: ${res.statusCode}`);
          if (res.statusCode === 200) {
            console.log('✅ Gemini API Key Authorized & Working!');
            resolve(true);
          } else {
            console.log('Gemini response:', data.substring(0, 200));
            resolve(false);
          }
        });
      }
    );
    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

async function testOpenRouter() {
  return new Promise((resolve) => {
    console.log('[AI Key Test] Testing OpenRouter / OpenAI compatible API...');
    const payload = JSON.stringify({
      model: 'google/gemini-flash-1.5-exp',
      messages: [{ role: 'user', content: 'Say OK' }],
    });

    const req = https.request(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          console.log(`[OpenRouter Test Status]: ${res.statusCode}`);
          if (res.statusCode === 200) {
            console.log('✅ OpenRouter API Key Authorized & Working!');
            resolve(true);
          } else {
            console.log('OpenRouter response:', data.substring(0, 200));
            resolve(false);
          }
        });
      }
    );
    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  const isGemini = await testGemini();
  if (!isGemini) {
    await testOpenRouter();
  }
}

runTests();
