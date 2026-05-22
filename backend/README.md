# FAQ Chat Agent — Backend Proxy

Express.js proxy server between the frontend chat widget (`js/chat-widget.js`) and Google Gemini API (`gemini-2.5-flash`). Handles security, rate limiting, conversation logging, and personalized lead context injection.

## Features

- **CORS Whitelisting** — allows `https://azhyshchev.de` and `https://www.azhyshchev.de` only. Localhost auto-added in `development` mode.
- **Security Headers** — via `helmet` middleware.
- **Widget Token Auth** — requires `X-Widget-Token` header matching `SECRET_WIDGET_TOKEN` env var.
- **Two-Tier Rate Limiting** — 25 req/IP/24h + 300 req global/24h (rolling window, in-memory).
- **Input Validation & Sanitization** — message max 500 chars, history max 8 items, lang must be `de` or `en`, sessionId max 100 chars, all HTML stripped.
- **Lead Context Injection** — if visitor shares their email, backend fetches their audit data from Supabase `leads` table and injects it into the system prompt. The agent then references the specific SEO/Maps diagnosis for their company.
- **Telegram Logging** — every conversation turn sent to a Telegram bot (non-blocking, optional).
- **Supabase Logging** — every turn written to `chat_logs` table (non-blocking, optional).
- **Local Gemini Cache** — in `development` and `test` modes, responses are cached to `gemini-cache.json` to avoid redundant API calls during development.
- **5s Timeout** — `AbortController` on every Gemini API fetch to prevent hung processes.
- **Health Check** — `GET /health` returns `{ status: "OK", timestamp }`.
- **Log Retrieval** — `GET /api/logs` returns latest 100 chat logs from Supabase (requires token).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Uptime check |
| POST | `/api/chat` | X-Widget-Token | Main chat endpoint |
| GET | `/api/logs` | X-Widget-Token | Fetch last 100 chat logs from Supabase |

### POST `/api/chat` — request body

```json
{
  "message": "string (max 500 chars)",
  "lang": "de" | "en",
  "history": [ { "role": "user"|"model", "parts": [{"text": "..."}] } ],
  "sessionId": "string (optional, max 100 chars)"
}
```

### POST `/api/chat` — response

```json
{ "reply": "string" }
```

Header `X-From-Cache: true` is set when the response was served from local cache.

## Local Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment — copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. Fill in `.env`:
   ```
   PORT=3000
   NODE_ENV=development

   # Required
   GEMINI_API_KEY=AIza...
   SECRET_WIDGET_TOKEN=your-secret-token

   # CORS (production URL, localhost added automatically in dev mode)
   CORS_ORIGIN=https://azhyshchev.de

   # Optional — Telegram logging
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...

   # Optional — Supabase logging + lead context
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_KEY=eyJ...
   ```

5. Run the server:
   ```bash
   # Development (with nodemon, cache enabled)
   npm run dev

   # Production
   npm start
   ```

## Gemini Cache (dev/test only)

In `development` or `test` mode (`NODE_ENV=development|test`), responses are cached to `backend/gemini-cache.json` by key `lang:message`. This prevents duplicate API calls during development and testing.

To disable cache in dev mode: set `DISABLE_CACHE=true` in `.env`.

Cache file is excluded from git (see `.gitignore`).

## Clients Dashboard

`clients/index.html` — internal dashboard that reads chat logs from `GET /api/logs` and displays them. Requires the `SECRET_WIDGET_TOKEN` to load data.

## Tests

```bash
# Verify security layers (CORS, token, rate limiting, input validation)
node tests/verify-limits.js

# Evaluate response quality (sends real questions, checks answer coverage)
node tests/evaluate-quality.js

# Check Supabase DB schema / connectivity
node tests/check-db.js
```

`verify-limits.js` uses mock-stubbed requests — does NOT call Gemini API, does not consume quota.

`evaluate-quality.js` sends live requests to Gemini — use sparingly.

## Railway Deployment

1. Create a new Railway project and connect your GitHub repository.
2. Railway auto-detects Node.js and runs `npm start`.
3. Add environment variables in Railway dashboard → **Variables** tab:

   ```
   PORT=3000
   NODE_ENV=production
   GEMINI_API_KEY=AIza...
   SECRET_WIDGET_TOKEN=your-secret-token
   CORS_ORIGIN=https://azhyshchev.de
   TELEGRAM_BOT_TOKEN=...       (optional)
   TELEGRAM_CHAT_ID=...         (optional)
   SUPABASE_URL=...             (optional)
   SUPABASE_KEY=...             (optional)
   ```

4. In Railway **Settings** → generate a public domain (e.g. `azhyshchev-chat.up.railway.app`).
5. Update `API_URL` in `js/chat-widget.js` to point to the Railway URL.
6. Set up a health monitor on `/health` in Railway to track uptime.

## Architecture

```
Visitor (azhyshchev.de)
    |
    | POST /api/chat { message, lang, history, sessionId }
    | Header: X-Widget-Token: <secret>
    v
Railway Server (Express.js)
    → CORS check
    → Token auth
    → Rate limit (25/IP/day, 300 global/day)
    → Input validation + HTML strip
    → Email extraction → Supabase leads lookup → lead context
    → Gemini API call (gemini-2.5-flash, temp=0.3, max 300 tokens)
    → Cache check (dev/test only)
    → Background: Telegram log + Supabase chat_logs write
    |
    v
{ reply: "..." }
```
