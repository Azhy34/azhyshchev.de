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
  const whitelist = [
    'https://azhyshchev.de',
    'https://www.azhyshchev.de'
  ];

  // Dynamically add CORS_ORIGIN env var if present (supports comma-separated list)
  if (process.env.CORS_ORIGIN) {
    const customOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
    customOrigins.forEach(o => {
      if (o && !whitelist.includes(o)) {
        whitelist.push(o);
      }
    });
  }
  
  if (process.env.NODE_ENV === 'development') {
    whitelist.push('http://localhost:5500');
    whitelist.push('http://127.0.0.1:5500');
    whitelist.push('http://localhost:3000');
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
  const { message, lang, history, sessionId } = req.body;

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

  // Validate sessionId (optional, but must be string and max 100 chars if present)
  let sanitizedSessionId = '';
  if (sessionId !== undefined) {
    if (typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Bad Request: sessionId must be a string' });
    }
    if (sessionId.length > 100) {
      return res.status(400).json({ error: 'Bad Request: sessionId must not exceed 100 characters' });
    }
    sanitizedSessionId = stripHtml(sessionId);
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
  req.sanitizedSessionId = sanitizedSessionId;
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

Your primary goal is to answer client questions about Mikhail's services, B2B workflow audits, and custom automation tools based STRICTLY on the FAQ database below.

### PERSONA & TONE
- Professional, warm, and highly structured.
- Brief and concise (3-5 sentences per response).
- Never guess or extrapolate. If an answer is not in the FAQ database, politely state that you do not have that information and offer to connect them with Mikhail (email: azhyshchev@gmail.com).
- Never decline to help with automation inquiries, but decline out-of-scope requests (e.g. coding general projects, news, weather, etc.) politely, offering to help with B2B automation instead.

### KNOWLEDGE BASE / FAQ DATABASE
1. WHO IS MIKHAIL AZHYSCHEV?
   Mikhail is a freelance AI Automation Engineer based in Munich, Germany. He specializes in designing and implementing automated B2B workflows, integrating large language models (LLMs) and APIs into existing business processes, developing custom AI agents, and deploying secure integrations.

2. WHAT B2B AUTOMATION SOLUTIONS DOES MIKHAIL DEVELOP?
   Mikhail builds high-performing B2B automation tools, including:
   - **"ADS_Az" (AI-Powered B2B Lead Gen & Audit Pipeline)**: Automatically finds German businesses on Google Maps via Apify, performs a detailed SEO, Google Maps and AI Search Visibility (GEO/JSON-LD) audit using Tavily and Gemini, scrapes legal contact information (managing director + email) from Impressum pages using Firecrawl, filters out corporate giants, and sends personalized cold email concepts via Resend API (with link tracking via links.azhyshchev.de).
   - **"soho-email" (Zoho Invoice Automation)**: Automatically scans a Zoho inbox once per weekday, downloads PDF invoice attachments, extracts text, uses Gemini 2.5 Flash to normalize invoice fields (supplier name, tax/VAT registration, net/VAT/gross amounts, and currency), and writes verified transaction data to Supabase.
   - **FAQ & Sales AI Agents**: Custom agents like this widget itself, running on a secure Express.js proxy with rate limiters and sanitizers to guarantee enterprise-grade safety.

3. WHY DID MIKHAIL EMAIL ME? / HOW DID YOU FIND ME?
   Mikhail runs his custom B2B outreach pipeline ("ADS_Az"). The pipeline autonomously identified your business, analyzed your site's local SEO and AI search visibility, extracted your contact information from your Impressum, and generated the personalized digital audit email you received. This outreach is a live demo of his automation capabilities.

4. WHAT IS A B2B AUTOMATION AUDIT?
   Mikhail conducts deep audits of business workflows to identify manual bottlenecks, high-volume tasks, and data-entry steps. He provides a customized automation roadmap showing which processes can be automated with AI, estimated complexity, and ROI.

5. GDPR / DSGVO COMPLIANCE ("Wie steht es um die DSGVO?")
   Compliance is a top priority. All solutions are hosted on secure EU-based servers (e.g., in Frankfurt, Germany). Mikhail provides a fully compliant Data Processing Agreement (DPA / AV-Vertrag) for B2B clients, ensuring all processing complies with the GDPR.

6. WEBSITE & SYSTEM ACCESS ("Muss ich Ihnen vollen Zugriff auf meine Website geben?")
   No, full access is never required. Mikhail operates under a "limited developer access model". He works with minimal scope API keys, secure sandbox/staging environments, and delegated access permissions. Clients retain full control, and no administrator credentials are ever shared.

7. PRICING & ESTIMATES
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

// Helper to escape HTML characters for secure Telegram HTML parsing
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Background, non-blocking logger for Telegram and Supabase
async function logConversation(sessionId, clientIp, lang, message, reply) {
  const timestamp = new Date().toISOString();

  // 1. Telegram Logging
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const tgUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const escapedSessionId = escapeHtml(sessionId || 'N/A');
    const escapedIp = escapeHtml(clientIp);
    const escapedLang = escapeHtml(lang);
    const escapedUser = escapeHtml(message);
    const escapedAgent = escapeHtml(reply);

    const text = `<b>💬 New Portfolio Chat Interaction</b>\n\n` +
      `<b>Session ID:</b> <code>${escapedSessionId}</code>\n` +
      `<b>IP Address:</b> <code>${escapedIp}</code>\n` +
      `<b>Language:</b> <code>${escapedLang}</code>\n\n` +
      `<b>User:</b> ${escapedUser}\n\n` +
      `<b>Agent:</b> ${escapedAgent}`;

    fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    })
    .then(res => {
      if (!res.ok) {
        return res.text().then(errText => {
          console.error(`Telegram Alert Error (status ${res.status}):`, errText);
        });
      }
    })
    .catch(err => {
      console.error('Failed to send Telegram alert:', err);
    });
  }

  // 2. Supabase Logging
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    const supabaseUrl = `${process.env.SUPABASE_URL}/rest/v1/chat_logs`;
    fetch(supabaseUrl, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        session_id: sessionId || null,
        ip_address: clientIp,
        language: lang,
        user_message: message,
        agent_reply: reply,
        timestamp: timestamp
      })
    })
    .then(res => {
      if (!res.ok) {
        return res.text().then(errText => {
          console.error(`Supabase Logging Error (status ${res.status}):`, errText);
        });
      }
    })
    .catch(err => {
      console.error('Failed to write log to Supabase:', err);
    });
  }
}

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

    // Background Logging (non-blocking)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
    logConversation(
      req.sanitizedSessionId,
      clientIp,
      req.body.lang,
      req.sanitizedMessage,
      replyText.trim()
    ).catch(err => {
      console.error('Error in logConversation wrapper:', err);
    });

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
