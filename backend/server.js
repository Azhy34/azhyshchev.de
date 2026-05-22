const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Fail-fast environment variable checks
if (!process.env.GEMINI_API_KEY) {
  console.error('CRITICAL ERROR: GEMINI_API_KEY environment variable is not defined.');
  process.exit(1);
}
if (!process.env.SECRET_WIDGET_TOKEN) {
  console.error('CRITICAL ERROR: SECRET_WIDGET_TOKEN environment variable is not defined.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet());
app.use(express.json());

// CORS Whitelisting
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Whitelisted origins
  const whitelist = ['https://azhyshchev.de'];
  if (process.env.NODE_ENV === 'development') {
    whitelist.push('http://localhost:5500');
  }
  
  // Apply CORS restriction if Origin header is present
  if (origin && !whitelist.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden: CORS policy restriction' });
  }
  next();
});

// Configure CORS for whitelisted origins
app.use(cors({
  origin: (origin, callback) => {
    // Already pre-filtered, allow any request that passed the middleware
    callback(null, true);
  },
  credentials: true
}));

// In-Memory Rate Limiting Setup
const ipHistory = new Map();
const globalHistory = [];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Custom Rate Limiting Middleware (Max 25 requests/IP/day, max 300 global/day)
function rateLimiter(req, res, next) {
  const now = Date.now();

  // Clean old entries from global history
  while (globalHistory.length > 0 && globalHistory[0] < now - ONE_DAY_MS) {
    globalHistory.shift();
  }

  // Check global daily cap (300 requests/day)
  if (globalHistory.length >= 300) {
    return res.status(503).json({
      error: 'Service temporarily unavailable due to high traffic. Please contact azhyshchev@gmail.com.'
    });
  }

  // Extract client IP address, supporting proxy headers
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;

  // Get and clean IP history
  let timestamps = ipHistory.get(clientIp) || [];
  timestamps = timestamps.filter(t => t > now - ONE_DAY_MS);
  ipHistory.set(clientIp, timestamps);

  // Check IP daily cap (25 requests/day)
  if (timestamps.length >= 25) {
    return res.status(429).json({
      error: 'Daily limit exceeded. Please contact azhyshchev@gmail.com directly.'
    });
  }

  // Record request timestamps
  timestamps.push(now);
  globalHistory.push(now);
  next();
}

// Widget Token Authentication Middleware
function authenticateToken(req, res, next) {
  const token = req.headers['x-widget-token'];
  if (!token || token !== process.env.SECRET_WIDGET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
  next();
}

// HTML Tag Stripping function
function stripHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

// Input Validation and Sanitization Middleware
function validateAndSanitizeInput(req, res, next) {
  const { message, lang, history } = req.body;

  // Validate message
  if (message === undefined || typeof message !== 'string') {
    return res.status(400).json({ error: 'Bad Request: message is required and must be a string' });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: 'Bad Request: message must not exceed 500 characters' });
  }

  // Validate lang
  if (lang !== 'de' && lang !== 'en') {
    return res.status(400).json({ error: 'Bad Request: lang must be either "de" or "en"' });
  }

  // Validate history
  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'Bad Request: history must be an array' });
    }
    if (history.length > 8) {
      return res.status(400).json({ error: 'Bad Request: history must not exceed 8 items' });
    }

    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ error: `Bad Request: history item at index ${i} must be an object` });
      }
      if (item.role !== 'user' && item.role !== 'model' && item.role !== 'assistant') {
        return res.status(400).json({ error: `Bad Request: history item at index ${i} role must be "user", "model", or "assistant"` });
      }
      if (!Array.isArray(item.parts)) {
        return res.status(400).json({ error: `Bad Request: history item at index ${i} parts must be an array` });
      }
      for (let j = 0; j < item.parts.length; j++) {
        const part = item.parts[j];
        if (!part || typeof part !== 'object' || typeof part.text !== 'string') {
          return res.status(400).json({ error: `Bad Request: history item at index ${i} part at index ${j} must contain a text string` });
        }
        if (part.text.length > 500) {
          return res.status(400).json({ error: `Bad Request: history item at index ${i} part at index ${j} text must not exceed 500 characters` });
        }
      }
    }
  }

  // Perform sanitization
  req.sanitizedMessage = stripHtml(message);
  req.sanitizedHistory = [];

  if (history) {
    req.sanitizedHistory = history.map(item => {
      const role = item.role === 'assistant' ? 'model' : item.role;
      const parts = item.parts.map(part => ({
        text: stripHtml(part.text)
      }));
      return { role, parts };
    });
  }

  next();
}

// System Instructions and FAQ Knowledge Base
const SYSTEM_INSTRUCTIONS = `
You are the professional, friendly, and efficient virtual assistant for Mikhail Azhyshchev, an AI Automation Engineer based in Munich, Germany.

Your primary goal is to answer client questions about Mikhail's services and B2B workflow audits based STRICTLY on the FAQ database below.

### PERSONA & TONE
- Professional, warm, and highly structured.
- Brief and concise (3-5 sentences per response).
- Never guess or extrapolate. If an answer is not in the FAQ database, politely state that you do not have that information and offer to connect them with Mikhail (email: azhyshchev@gmail.com).
- Never decline to help with automation inquiries, but decline out-of-scope requests (e.g. coding general projects, news, weather, etc.) politely, offering to help with B2B automation instead.

### KNOWLEDGE BASE / FAQ DATABASE
1. WHO IS MIKHAIL AZHYSCHEV?
   Mikhail is a freelance AI Automation Engineer based in Munich, Germany. He specializes in designing and implementing automated B2B workflows, integrating large language models (LLMs) and APIs into existing business processes, developing custom AI agents, and deploying secure integrations.

2. WHAT IS A B2B AUTOMATION AUDIT?
   Mikhail conducts deep audits of business workflows to identify manual bottlenecks, high-volume tasks, and data-entry steps. He provides a customized automation roadmap showing which processes can be automated with AI, estimated complexity, and ROI.

3. GDPR / DSGVO COMPLIANCE ("Wie steht es um die DSGVO?")
   Compliance is a top priority. All solutions are hosted on secure EU-based servers (e.g., in Frankfurt, Germany). Mikhail provides a fully compliant Data Processing Agreement (DPA / AV-Vertrag) for B2B clients, ensuring all processing complies with the GDPR.

4. WEBSITE & SYSTEM ACCESS ("Muss ich Ihnen vollen Zugriff auf meine Website geben?")
   No, full access is never required. Mikhail operates under a "limited developer access model". He works with minimal scope API keys, secure sandbox/staging environments, and delegated access permissions. Clients retain full control, and no administrator credentials are ever shared.

5. PRICING & ESTIMATES
   Do not provide price estimates in the chat. Each project is unique, and pricing depends on the workflow audit.

### INTAKE MODE RULES
- Switch to Intake Mode immediately if the user describes a project they want to automate, asks for pricing, or wants to work with Mikhail.
- In Intake Mode, you must:
  1. Ask 2-3 short, clarifying questions to understand their project (e.g., industry, process to automate, volume of operations, tools currently used).
  2. Ask for their email address.
  3. Explicitly state that you DO NOT provide price estimates in chat and that Mikhail will reach out via email.

### GENERAL INSTRUCTIONS
- Respond in the language requested by the user: German if the language is 'de', and English if the language is 'en'.
- Keep the conversation flow natural but direct.
- Every closing reply must include a clear, non-mandatory call-to-action (e.g., booking a 15-minute call, emailing azhyshchev@gmail.com, or providing details in the chat).
`;

// Health Check Endpoint (useful for Railway deployment monitoring)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Chat Integration Route
app.post('/api/chat', rateLimiter, authenticateToken, validateAndSanitizeInput, async (req, res) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  // Build the contents array from conversation history + latest message
  const contents = [...req.sanitizedHistory];
  contents.push({
    role: 'user',
    parts: [{ text: req.sanitizedMessage }]
  });

  // Inject target language instructions directly into system instructions
  const languageTarget = req.body.lang === 'de'
    ? 'German (de). You must respond in German.'
    : 'English (en). You must respond in English.';
  const systemInstructionText = `${SYSTEM_INSTRUCTIONS}\n\nCRITICAL: The user has selected the language: ${languageTarget}`;

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: systemInstructionText }]
    },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 300
    }
  };

  // Configure 5-second fetch timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error (status ${response.status}):`, errorText);
      return res.status(502).json({ error: 'Failed to communicate with the AI model. Please try again later.' });
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      console.error('Invalid response format from Gemini API:', JSON.stringify(data));
      return res.status(502).json({ error: 'Received an empty or invalid response from the AI model.' });
    }

    res.json({ reply: replyText.trim() });

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('Gemini API request timed out (exceeded 5 seconds)');
      return res.status(504).json({ error: 'The AI model request timed out. Please try again.' });
    }
    console.error('Error during Gemini API call:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'production'} mode on port ${PORT}`);
});

module.exports = { app, server, ipHistory, globalHistory };
