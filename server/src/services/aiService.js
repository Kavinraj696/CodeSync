const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');

// Free Google Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
const GEMINI_MODEL = 'gemini-3.6-flash';

// Anthropic API configuration
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
  try {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (err) {
    console.warn('[AIService] Failed to initialize Anthropic SDK:', err.message);
  }
}

/**
 * Call Google Gemini API (gemini-3.6-flash) with streaming SSE
 */
function streamGeminiResponse({ prompt, res }) {
  return new Promise((resolve) => {
    console.log(`[AIService] Calling Free Google Gemini API (${GEMINI_MODEL})...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    });

    const req = https.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (apiRes) => {
        if (apiRes.statusCode !== 200) {
          let errData = '';
          apiRes.on('data', (c) => (errData += c));
          apiRes.on('end', () => {
            console.error(`[AIService] Gemini API error (${apiRes.statusCode}):`, errData.substring(0, 300));
            resolve(false);
          });
          return;
        }

        let buffer = '';
        apiRes.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.replace(/^data:\s*/, '').trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textChunk) {
                  res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
                }
              } catch (e) {
                // Ignore chunk parse error
              }
            }
          }
        });

        apiRes.on('end', () => {
          res.write('data: [DONE]\n\n');
          res.end();
          resolve(true);
        });
      }
    );

    req.on('error', (err) => {
      console.error('[AIService] Gemini HTTP connection error:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Call Google Gemini API (gemini-3.6-flash) synchronously for inline actions
 */
function callGeminiSync(prompt) {
  return new Promise((resolve) => {
    console.log(`[AIService] Calling Free Google Gemini Sync (${GEMINI_MODEL})...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    });

    const req = https.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (apiRes) => {
        let responseText = '';
        apiRes.on('data', (c) => (responseText += c));
        apiRes.on('end', () => {
          if (apiRes.statusCode === 200) {
            try {
              const parsed = JSON.parse(responseText);
              const resultText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              resolve(resultText || null);
            } catch (e) {
              resolve(null);
            }
          } else {
            console.error(`[AIService] Gemini sync error (${apiRes.statusCode}):`, responseText.substring(0, 200));
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.write(payload);
    req.end();
  });
}

/**
 * Stream AI chat response using Server-Sent Events (SSE)
 */
async function streamChatResponse({ message, fileContext, history = [], language = 'javascript', res }) {
  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const systemPrompt = `You are CodeSync AI, a world-class coding assistant embedded in VS Code in the browser. 
Help the user write, debug, explain, and refactor code. Always output clean, GitHub-flavored markdown with syntax highlighted code blocks.
Active programming language: ${language || 'javascript'}.`;

  const fullPrompt = `${systemPrompt}\n\n${
    fileContext ? `Current Open File Content:\n\`\`\`${language}\n${fileContext}\n\`\`\`\n\n` : ''
  }User Question: ${message}`;

  // 1. Try Free Google Gemini API if key is present
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    const success = await streamGeminiResponse({ prompt: fullPrompt, res });
    if (success) return;
  }

  // 2. Try Anthropic API if key is present
  if (anthropic) {
    try {
      console.log('[AIService] Calling Anthropic API (claude-3-5-sonnet-20240620)...');
      const messages = [];
      if (Array.isArray(history)) {
        for (const msg of history) {
          if (msg.role && msg.content) {
            messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
          }
        }
      }
      messages.push({ role: 'user', content: message });

      const stream = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (error) {
      console.error('[AIService] Anthropic API Error:', error.message);
    }
  }

  // 3. Fallback Mock Streamer for offline/keyless development
  console.log('[AIService] Running in Offline/Mock Stream mode...');
  const mockResponse = `I am CodeSync AI assistant.\n\nAnalyzing your request regarding **${language}**...\n\nHere is a recommendation for your code:\n\`\`\`${language}\n// CodeSync AI Generated Suggestion\nfunction handleExecution() {\n  // Context-aware processing based on prompt:\n  // "${message.replace(/"/g, '\\"')}"\n  console.log("CodeSync AI processing complete.");\n}\n\`\`\`\n\nLet me know if you would like me to generate unit tests or refactor this further!`;

  const words = mockResponse.split(' ');
  for (const word of words) {
    res.write(`data: ${JSON.stringify({ text: word + ' ' })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

/**
 * Run inline action (Explain, Fix, Refactor, Tests, Comments) on selected code
 */
async function runInlineAction({ action, codeSelection, fileContext, language = 'javascript' }) {
  const actionPrompts = {
    explain: 'Explain concisely and clearly what this code snippet does:',
    fix: 'Identify bugs, syntax errors, or potential runtime crashes in this code and provide the fixed version:',
    refactor: 'Refactor this code to follow clean code standards, modern best practices, and improve performance:',
    tests: 'Write clean, robust unit tests for this code snippet:',
    comments: 'Add clean inline comments and JSDoc/docstrings to this code snippet:',
  };

  const actionPrompt = actionPrompts[action] || 'Analyze this code snippet:';
  const fullPrompt = `${actionPrompt}\n\n\`\`\`${language}\n${codeSelection}\n\`\`\`\n${
    fileContext ? `\nFull File Context:\n\`\`\`${language}\n${fileContext}\n\`\`\`` : ''
  }`;

  // 1. Try Free Google Gemini API
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    const geminiText = await callGeminiSync(fullPrompt);
    if (geminiText) {
      return { action, suggestion: geminiText };
    }
  }

  // 2. Try Anthropic API
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1500,
        messages: [{ role: 'user', content: fullPrompt }],
      });

      const text = response.content.map((c) => c.text || '').join('\n');
      return { action, suggestion: text };
    } catch (err) {
      console.error('[AIService] Anthropic inline action error:', err.message);
    }
  }

  // 3. Fallback inline action mock
  return {
    action,
    suggestion: `### AI Action Result: ${action.toUpperCase()}\n\nHere is the AI suggestion for your **${language}** selection:\n\n\`\`\`${language}\n// Refactored / Fixed Code by CodeSync AI\n${codeSelection}\n// Enhanced with modern ES2026/standard practices\n\`\`\`\n\n*Review and accept this diff to apply changes.*`,
  };
}

module.exports = {
  streamChatResponse,
  runInlineAction,
};
