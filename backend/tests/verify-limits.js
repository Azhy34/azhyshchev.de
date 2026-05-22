const assert = require('assert');
const http = require('http');

// Set dummy environment variables to satisfy server startup checks
process.env.PORT = 0; // Let the OS assign a random available port
process.env.GEMINI_API_KEY = 'mock-gemini-key';
process.env.SECRET_WIDGET_TOKEN = 'test-secret-token';
process.env.NODE_ENV = 'development';

const { app, server, ipHistory, globalHistory } = require('../server');

// Helper to construct request target
const address = server.address();
const port = address.port;
const BASE_URL = `http://localhost:${port}`;

// Stub global fetch to prevent hitting the external Gemini API during tests
const originalFetch = global.fetch;
let lastGeminiPayload = null;

global.fetch = async (url, options) => {
  if (url.includes('generativelanguage.googleapis.com')) {
    lastGeminiPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: "This is a mock reply from Gemini." }]
          }
        }]
      })
    };
  }
  return { ok: false, status: 404 };
};

async function runTests() {
  console.log('--- Starting Express Backend Verification Suite ---');

  try {
    // Test 1: Health check
    console.log('Testing /health endpoint...');
    const healthRes = await makeRequest('/health');
    assert.strictEqual(healthRes.status, 200);
    const healthData = JSON.parse(healthRes.body);
    assert.strictEqual(healthData.status, 'OK');
    console.log('✅ /health endpoint passed.');

    // Test 2: Token Verification (Missing Token)
    console.log('Testing missing X-Widget-Token...');
    const tokenMissingRes = await makeRequest('/api/chat', {
      method: 'POST',
      body: { message: 'Hello', lang: 'en' }
    });
    assert.strictEqual(tokenMissingRes.status, 401);
    console.log('✅ Missing token rejected with 401.');

    // Test 3: Token Verification (Invalid Token)
    console.log('Testing invalid X-Widget-Token...');
    const tokenInvalidRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'X-Widget-Token': 'wrong-token' },
      body: { message: 'Hello', lang: 'en' }
    });
    assert.strictEqual(tokenInvalidRes.status, 401);
    console.log('✅ Invalid token rejected with 401.');

    // Test 4: CORS Block (Production origin block)
    console.log('Testing CORS origin validation...');
    const corsRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'X-Widget-Token': 'test-secret-token',
        'Origin': 'https://malicious.com'
      },
      body: { message: 'Hello', lang: 'en' }
    });
    assert.strictEqual(corsRes.status, 403);
    console.log('✅ CORS block returned 403 Forbidden for malicious origin.');

    // Test 5: CORS Allow (Whitelisted Development origin)
    console.log('Testing whitelisted Origin...');
    const corsAllowRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'X-Widget-Token': 'test-secret-token',
        'Origin': 'http://localhost:5500'
      },
      body: { message: 'Hello', lang: 'en' }
    });
    assert.strictEqual(corsAllowRes.status, 200);
    console.log('✅ CORS allowed development origin.');

    // Test 6: Input Validation (Invalid structure/lengths)
    console.log('Testing message length verification (>500 chars)...');
    const longMessage = 'a'.repeat(501);
    const validationRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'X-Widget-Token': 'test-secret-token' },
      body: { message: longMessage, lang: 'en' }
    });
    assert.strictEqual(validationRes.status, 400);
    console.log('✅ Messages exceeding 500 characters rejected with 400.');

    console.log('Testing invalid language...');
    const langRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'X-Widget-Token': 'test-secret-token' },
      body: { message: 'Hello', lang: 'fr' }
    });
    assert.strictEqual(langRes.status, 400);
    console.log('✅ Languages other than de/en rejected with 400.');

    // Test 7: Input Sanitization (Stripping HTML tags)
    console.log('Testing HTML tag sanitization...');
    const htmlMessage = 'Hello <script>alert("hack")</script>world <b>bold</b>';
    const sanitizeRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'X-Widget-Token': 'test-secret-token' },
      body: { message: htmlMessage, lang: 'en' }
    });
    assert.strictEqual(sanitizeRes.status, 200);
    // The tags should be stripped out
    assert.strictEqual(lastGeminiPayload.contents[0].parts[0].text, 'Hello alert("hack")world bold');
    console.log('✅ HTML tag sanitization verified.');

    // Test 8: Rate Limiting (IP Limit of 25 requests)
    console.log('Testing IP rate limiter (25 requests max)...');
    // Clear histories first
    ipHistory.clear();
    globalHistory.length = 0;

    const TEST_IP = '1.2.3.4';
    for (let i = 0; i < 25; i++) {
      const res = await makeRequest('/api/chat', {
        method: 'POST',
        headers: {
          'X-Widget-Token': 'test-secret-token',
          'X-Forwarded-For': TEST_IP
        },
        body: { message: `Request number ${i + 1}`, lang: 'en' }
      });
      assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
    }

    // 26th request should fail with 429
    const limitExceededRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'X-Widget-Token': 'test-secret-token',
        'X-Forwarded-For': TEST_IP
      },
      body: { message: 'Request number 26', lang: 'en' }
    });
    assert.strictEqual(limitExceededRes.status, 429);
    console.log('✅ 26th request blocked with 429 Too Many Requests.');

    // Test 9: Global Daily Cap (300 requests)
    console.log('Testing global rate limiter (300 requests max)...');
    ipHistory.clear();
    globalHistory.length = 0;

    // Simulate 300 requests from different IPs
    for (let i = 0; i < 300; i++) {
      const uniqueIp = `100.0.0.${i}`;
      const res = await makeRequest('/api/chat', {
        method: 'POST',
        headers: {
          'X-Widget-Token': 'test-secret-token',
          'X-Forwarded-For': uniqueIp
        },
        body: { message: `Request ${i + 1}`, lang: 'en' }
      });
      assert.strictEqual(res.status, 200, `Global request ${i + 1} should succeed`);
    }

    // 301st request from a fresh IP should fail with 503
    const globalLimitExceededRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'X-Widget-Token': 'test-secret-token',
        'X-Forwarded-For': '200.200.200.200'
      },
      body: { message: 'Request number 301', lang: 'en' }
    });
    assert.strictEqual(globalLimitExceededRes.status, 503);
    console.log('✅ 301st global request blocked with 503 Service Unavailable.');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
    cleanup(0);

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    cleanup(1);
  }
}

// Helper function to make HTTP requests using native http.request
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function cleanup(exitCode) {
  server.close(() => {
    console.log('Server shut down cleanly.');
    global.fetch = originalFetch;
    process.exit(exitCode);
  });
}

runTests();
