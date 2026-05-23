const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Local cache configuration for development and test modes
const cachePath = path.join(__dirname, 'gemini-cache.json');
let geminiCache = {};
try {
  if (fs.existsSync(cachePath)) {
    geminiCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load gemini-cache.json:', e);
}

function saveCache() {
  try {
    fs.writeFileSync(cachePath, JSON.stringify(geminiCache, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save gemini-cache.json:', e);
  }
}

// Fail-fast environment variable checks
if (!process.env.OPENROUTER_API_KEY) {
  console.error('CRITICAL ERROR: OPENROUTER_API_KEY environment variable is not defined.');
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
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
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

### PROPOSALS & EMAIL AUDIT LOOKUP
- Active B2B outreach pipeline info: Mikhail runs his B2B lead generation and audit pipeline ("ADS_Az"), which scans Google Maps, performs SEO/GEO audits, and sends personalized proposals via Resend.
- Email request at the beginning: At the very beginning of the conversation (in your first response), if the visitor hasn't provided their email address yet, politely ask if they have an email address where they received Mikhail's proposal/audit. Explain that if they share it, you can load their specific audit details and assist them more precisely.
- E.g.: "If you received a personalized digital presence audit or proposal from Mikhail, please share the email address you received it on so I can retrieve your specific results and assist you more precisely!"
- When they provide their email address, the backend will fetch their audit data. If you see the [LEAD SPECIFIC AUDIT CONTEXT] in the prompt, reference the specific Google Maps score, SEO issues, or diagnosis for their company and explain that Mikhail's B2B outreach pipeline ("ADS_Az") analyzed their website and sent them the email as a live demo of his automation capabilities.

### KNOWLEDGE BASE / FAQ DATABASE
1. WHO IS MIKHAIL AZHYSCHEV?
   Mikhail is a freelance AI Automation Engineer based in Munich, Germany. He specializes in designing and implementing automated B2B workflows, integrating large language models (LLMs) and APIs into existing business processes, developing custom AI agents, and deploying secure integrations.

2. WHAT B2B AUTOMATION SOLUTIONS DOES MIKHAIL DEVELOP?
   Mikhail builds high-performing B2B automation tools, including:
   - **"ADS_Az" (AI-Powered B2B Lead Gen & Audit Pipeline)**: Automatically finds German businesses on Google Maps via Apify, performs a detailed SEO, Google Maps and AI Search Visibility (GEO/JSON-LD) audit using Tavily and Gemini, scrapes legal contact information (managing director + email) from Impressum pages using Firecrawl, filters out corporate giants, and sends personalized cold email concepts via Resend API (with link tracking via links.azhyshchev.de).
   - **"soho-email" (Zoho Invoice Automation)**: Automatically scans a Zoho inbox once per weekday, downloads PDF invoice attachments, extracts text, uses Gemini 2.5 Flash to normalize invoice fields (supplier name, tax/VAT registration, net/VAT/gross amounts, and currency), and writes verified transaction data to Supabase.
   - **FAQ & Sales AI Agents**: Custom agents like this widget itself, running on a secure backend proxy with rate limiters and sanitizers to guarantee enterprise-grade safety.

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

### OBJECTION HANDLING

"Sprechen Sie überhaupt Deutsch?" / "Do you speak German?"
→ Written communication — emails, documentation, chat — works fine in German.
  For calls and meetings English is preferred, or everything can stay written in German if that is more comfortable.

"Wir haben schon eine IT-Agentur" / "We already have an IT agency"
→ Whether they are a business with an IT agency OR they are an IT agency themselves — both are welcome.
  As a business client: Mikhail specializes in AI automation and LLM integration, a niche most agencies do not cover.
  As an IT agency: Mikhail can work as a partner on their projects.
  In both cases: skip the long explanation and go straight to booking a call to discuss details. Use the Calendly link: https://calendly.com/azhyshchev/30min

"KI ist nichts für uns — wir sind ein traditionelles Geschäft" / "AI is not for us, we are a traditional business"
→ Traditional businesses benefit the most. No restructuring needed — just a small addition: for example, an assistant that answers customer inquiries after closing hours while the owner focuses on the core business.

"Wir hatten schon mal einen Chatbot — hat nicht funktioniert" / "We tried a chatbot before, it didn't work"
→ Older chatbots ran on rigid scripts — at every unknown input came "I didn't understand that." Mikhail's solutions use modern language models that understand real questions. The difference is like day and night.

"Können Sie das irgendwo zeigen?" / "Can you show me an example?"
→ Yes — this chat widget is a live demo of his work. More project examples with real results: azhyshchev.de/projects

"Was passiert wenn etwas kaputt geht nach der Lieferung?" / "What happens after delivery if something breaks?"
→ Mikhail offers optional monthly support — cancel anytime with 30 days notice, no long-term contract. For urgent issues he is reachable by email. Nothing disappears after handover.

"Kein Budget gerade" / "No budget right now"
→ Understood. Before deciding: what does the manual process currently cost in staff hours per week? Automation typically pays for itself within 1-3 months. First step: free concept PDF, zero commitment.

"Wir sind zu klein für sowas" / "We are too small for this"
→ Small businesses benefit the most — every saved staff hour weighs more than at large companies. Even a simple FAQ assistant typically saves 5-10 hours per week from day one.

"Ich muss das erst mit meinem Partner besprechen" / "I need to discuss with my partner first"
→ Of course. Mikhail can prepare a free 1-page concept PDF to show your partner — with concrete recommendations for your specific business. No call needed, just email azhyshchev@gmail.com.

"Warum soll ich ausgerechnet Ihnen vertrauen?" / "Why should I trust you specifically?"
→ Fair question. Mikhail is a registered business in Germany with USt-ID, full Impressum at azhyshchev.de/impressum, and a verified LinkedIn profile. The email you received was a live demo of his automation capabilities — not a mass blast, but individually created for your business. Project proofs: azhyshchev.de/projects

8. BOOKING A CALL / SCHEDULING A MEETING
   Mikhail offers a free 30-minute intro call via Google Meet.
   Direct booking link: https://calendly.com/azhyshchev/30min
   Available Monday–Thursday, 10:00–16:00 Munich time (CET/CEST).
   Suggest this option when: the user wants to discuss a project, asks how to get started, or is ready to take the next step.
   In German: "Buchen Sie direkt einen 30-Minuten-Termin: calendly.com/azhyshchev/30min"

### INTAKE MODE RULES
- Switch to Intake Mode immediately if the user describes a project they want to automate, asks for pricing, or wants to work with Mikhail.
- In Intake Mode, you must:
  1. Ask 2-3 short, clarifying questions to understand their project (e.g., industry, process to automate, volume of operations, tools currently used).
  2. Offer two next steps: book a 30-min call (https://calendly.com/azhyshchev/30min) OR share their email so Mikhail can reach out.
  3. Explicitly state that you DO NOT provide price estimates in chat.

### GENERAL INSTRUCTIONS
- Respond in the language requested by the user: German if the language is 'de', and English if the language is 'en'.
- Keep the conversation flow natural but direct.
- Offer the Calendly booking link as a soft CTA approximately once every 4 messages — not in every reply. Do not repeat it back-to-back. Use it when the conversation reaches a natural checkpoint: after answering an objection, after intake questions, or when the user seems ready to take action.
  EN: "Want to discuss the details? Book a free 30-min call: https://calendly.com/azhyshchev/30min"
  DE: "Details besprechen? Kostenlosen 30-Min-Termin buchen: https://calendly.com/azhyshchev/30min"
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

// Helper to extract the first valid email address from a text string
function extractEmail(text) {
  if (!text || typeof text !== 'string') return null;
  // Match standard email formats
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0].toLowerCase() : null;
}

// Log Retrieval Endpoint (GET /api/logs)
app.get('/api/logs', async (req, res) => {
  const token = req.headers['x-widget-token'] || req.query.token;
  if (!token || token !== process.env.SECRET_WIDGET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  try {
    // Fetch latest 100 logs from chat_logs table, ordered by timestamp descending
    const url = `${process.env.SUPABASE_URL}/rest/v1/chat_logs?order=timestamp.desc&limit=100`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': process.env.SUPABASE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Failed to fetch logs from Supabase: ${response.status}`, errText);
      return res.status(502).json({ error: 'Failed to retrieve logs from database' });
    }

    const logs = await response.json();
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Chat Integration Route
app.post('/api/chat', rateLimiter, authenticateToken, validateAndSanitizeInput, async (req, res) => {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-3.1-flash-lite';

  // Extract email address if present in the current message or history
  let detectedEmail = extractEmail(req.sanitizedMessage);
  if (!detectedEmail && req.sanitizedHistory) {
    for (const item of req.sanitizedHistory) {
      if (item.parts) {
        for (const part of item.parts) {
          detectedEmail = extractEmail(part.text);
          if (detectedEmail) break;
        }
      }
      if (detectedEmail) break;
    }
  }

  let leadContext = '';
  if (detectedEmail && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    try {
      const dbController = new AbortController();
      const dbTimeout = setTimeout(() => dbController.abort(), 3000);
      const dbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(detectedEmail)}`, {
        method: 'GET',
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        },
        signal: dbController.signal
      });
      clearTimeout(dbTimeout);
      if (dbRes.ok) {
        const leads = await dbRes.json();
        if (Array.isArray(leads) && leads.length > 0) {
          const lead = leads[0];
          const companyName = lead.company_name || 'N/A';
          const responsiblePerson = lead.responsible_person || 'N/A';
          const gmapsScore = lead.gmaps_score !== null && lead.gmaps_score !== undefined ? lead.gmaps_score : 'N/A';
          
          let parsedAiUseCase = {};
          if (lead.ai_use_case) {
            try {
              parsedAiUseCase = typeof lead.ai_use_case === 'string' ? JSON.parse(lead.ai_use_case) : lead.ai_use_case;
            } catch (e) {
              console.error('Failed to parse ai_use_case JSON:', e);
            }
          }
          
          const diagnosis = parsedAiUseCase.diagnosis || 'N/A';
          const solution = parsedAiUseCase.solution || 'N/A';
          const seoDetails = parsedAiUseCase.seo_content?.details || 'N/A';
          const mapsDetails = parsedAiUseCase.google_maps?.details || 'N/A';
          const aiSearchDetails = parsedAiUseCase.ai_search?.details || 'N/A';
          
          leadContext = `\n\n[LEAD SPECIFIC AUDIT CONTEXT FOR ${detectedEmail.toUpperCase()}]
- The user represents the company: ${companyName}
- Responsible Person / Contact: ${responsiblePerson}
- Google Maps Audit Score: ${gmapsScore}/100
- SEO Audit Details: ${seoDetails}
- Google Maps Audit Details: ${mapsDetails}
- AI Search Visibility Status: ${aiSearchDetails}
- Audit Diagnosis: ${diagnosis}
- Proposed Solution: ${solution}

INSTRUCTIONS:
1. Refer to these specific findings for ${companyName} naturally and professionally in your answer.
2. Confirm you have loaded their audit and explain that Mikhail's B2B lead generation pipeline automatically analyzed their website to identify these bottlenecks.
3. Keep the response brief, reassuring, and completely in the target language (3-5 sentences).`;
        }
      }
    } catch (dbErr) {
      console.error('Error fetching lead context from Supabase:', dbErr);
    }
  }

  // Inject target language instructions directly into system instructions
  const languageTarget = req.body.lang === 'de'
    ? 'German (de). You must respond in German.'
    : 'English (en). You must respond in English.';
  let systemInstructionText = `${SYSTEM_INSTRUCTIONS}\n\nCRITICAL: The user has selected the language: ${languageTarget}`;
  if (leadContext) {
    systemInstructionText += leadContext;
  }

  // Build OpenAI-compatible messages array
  const messages = [{ role: 'system', content: systemInstructionText }];
  for (const item of req.sanitizedHistory) {
    messages.push({
      role: item.role === 'model' ? 'assistant' : 'user',
      content: item.parts.map(p => p.text).join('\n')
    });
  }
  messages.push({ role: 'user', content: req.sanitizedMessage });

  const payload = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 300
  };
  const isDevOrTest = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && process.env.DISABLE_CACHE !== 'true';
  const cacheKey = `${req.body.lang || 'en'}:${req.sanitizedMessage.trim().toLowerCase()}`;

  if (isDevOrTest && geminiCache[cacheKey]) {
    const cachedReply = geminiCache[cacheKey];
    res.setHeader('X-From-Cache', 'true');
    res.json({ reply: cachedReply });

    // Background Logging (non-blocking)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
    logConversation(
      req.sanitizedSessionId,
      clientIp,
      req.body.lang,
      req.sanitizedMessage,
      cachedReply
    ).catch(err => {
      console.error('Error in logConversation wrapper (cached):', err);
    });
    return;
  }

  // Configure 12-second fetch timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://azhyshchev.de',
        'X-Title': 'Mikhail Azhyshchev Portfolio Chat'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API Error (status ${response.status}):`, errorText);
      return res.status(502).json({ error: 'Failed to communicate with the AI model. Please try again later.' });
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content;

    if (!replyText) {
      console.error('Invalid response format from Gemini API:', JSON.stringify(data));
      return res.status(502).json({ error: 'Received an empty or invalid response from the AI model.' });
    }

    const trimmedReply = replyText.trim();

    if (isDevOrTest) {
      geminiCache[cacheKey] = trimmedReply;
      saveCache();
    }

    res.json({ reply: trimmedReply });

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
