# CLAUDE.md — portfolio/

Technical documentation for azhyshchev.de. Keep this file up to date when adding features.

## Architecture overview

| Layer | Technology | Hosting | Deploy |
|-------|-----------|---------|--------|
| Frontend | Static HTML/CSS/JS | GitHub Pages | `git push` auto-deploys |
| Chat backend | Node.js + Express | Railway (`azhyshchev.de` service) | `git push` same repo |
| AI Checker API | Python + FastAPI | Railway (`ai-readiness-api` service) | `cd portfolio/api && railway up` |
| AI Checker DB | PostgreSQL | Railway (Postgres service, project `jubilant-tenderness`) | auto-managed |
| Chat logs | Supabase (PostgreSQL) | Supabase cloud | — |
| AI model | OpenRouter API | — | model: `google/gemini-3.1-flash-lite` |
| Email outreach | Resend API | — | used in ADS_Az pipeline (separate project) |
| Scheduling | Calendly | calendly.com | `calendly.com/azhyshchev/30min` |

**Frontend + chat backend:** one `git push` deploys both.
**AI Checker API:** deploy separately via `cd portfolio/api && railway up` (must run from `api/` folder, not repo root).

## Railway CLI

Already authenticated as `azhischev1@gmail.com`. Use directly from terminal.

**Chat backend service:**
```bash
railway link -p jubilant-tenderness -s 68396619-49be-430b-bcde-aaf1b116198d
railway variables set KEY="value"
railway variables list
```

**AI Checker API service:**
```bash
cd portfolio/api && railway up
```

**Projects:**
| Project | Service | Purpose |
|---------|---------|---------|
| `jubilant-tenderness` | `azhyshchev.de` (ID: `68396619-49be-430b-bcde-aaf1b116198d`) | Chat backend |
| `jubilant-tenderness` | `ai-readiness-api` | AI Checker FastAPI |
| `jubilant-tenderness` | Postgres | AI Checker DB |

## GA4 Analytics API

Endpoint: `GET https://azhyshchevde-production.up.railway.app/api/analytics?range=7daysAgo`
Auth: `X-Widget-Token: 3530a5f865dcb0cc6489f5999cb0bfcb`
Returns: top pages (views, sessions, users, bounce rate) + top events for given date range.

**Service account:** `ga4-reader@azhyshchev.iam.gserviceaccount.com` (Viewer on GA4 + Restricted on GSC)
**Env vars on Railway:** `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY`
**Property ID:** `513620625` (account `tappe-25b1a`, ID `375555359`)

To get analytics report: call the endpoint directly via Bash — no need to open GA4 UI.

## GSC Search Console API

Endpoint: `GET https://azhyshchevde-production.up.railway.app/api/gsc?days=90`
Auth: `X-Widget-Token: 3530a5f865dcb0cc6489f5999cb0bfcb`
Returns: top queries (clicks, impressions, ctr, position) + top pages for given days range.

**Auth method:** OAuth2 refresh token (user account Azhischev1@gmail.com owns the GSC property).
GSC UI doesn't accept service account emails — only regular Google accounts.
**Env vars on Railway:** `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`
**Site property:** `sc-domain:azhyshchev.de`
**Endpoint:** `GET /api/gsc` in `portfolio/backend/server.js`

## GA4 Events implemented

| Event | Trigger | Location |
|-------|---------|---------|
| `page_view` | auto (Enhanced Measurement) | all pages |
| `scroll`, `file_download`, `outbound_click` | auto (Enhanced Measurement) | all pages |
| `chat_open` | widget open | all pages |
| `chat_language_selected` | language pick | widget |
| `chat_message_sent` | message sent | widget |
| `generate_lead` | email detected in chat | widget |
| `book_call_click` | Calendly button click | contact, ai-checker, widget |
| `project_view` | modal open | /projects |
| `cv_download` | CV.pdf click | /experience, /skills, /cv |
| `linkedin_click` | sidebar LinkedIn | /experience |
| `ai_checker_analyze` | Analyze button | /ai-checker |

**Key Events (конверсии) — пометить в GA4 UI:** `book_call_click`, `cv_download`, `generate_lead`

**Custom Dimensions — зарегистрировать в GA4 Admin → Custom Definitions:**
- `project_name` (event-scoped) — для `project_view`
- `location` (event-scoped) — для `cv_download`, `book_call_click`

**UTM на Calendly ссылках:** `utm_source=portfolio&utm_campaign=booking&utm_content=<contact|ai_checker|chat_header>`

**Data Retention:** поставить 14 месяцев в GA4 Admin → Data Settings → Data Retention.

---

## File structure

```
portfolio/
├── index.html                  # Home / landing
├── experience/index.html       # Work experience
├── projects/index.html         # Projects gallery (cards + modals)
├── skills/index.html           # Skills overview
├── articles/index.html         # LinkedIn articles
├── cv/index.html               # CV page
├── contact/index.html          # Contact — has Calendly "Book a call" button
├── impressum/index.html        # Legal
├── datenschutz/index.html      # GDPR — covers GA4, chat widget, B2B outreach
├── agb/index.html              # Terms
├── de/                         # German version (hreflang="de") — added 2026-06-09
│   ├── index.html              # /de/ — Startseite
│   ├── erfahrung/index.html    # /de/erfahrung/ — Berufserfahrung
│   ├── projekte/index.html     # /de/projekte/ — Projekte
│   ├── fahigkeiten/index.html  # /de/fahigkeiten/ — Fähigkeiten
│   └── kontakt/index.html      # /de/kontakt/ — Kontakt
├── mobile.css                  # Shared mobile responsive styles (≤820px)
├── js/
│   ├── chat-widget.js          # Chat widget (IIFE, vanilla JS)
│   ├── chat-widget.css         # Widget styles (neobrutalist)
│   └── nav.js                  # Mobile nav toggle + switchLang() for EN↔DE
├── ai-checker/                 # AI Readiness Checker page
│   ├── index.html              # Checker UI (neobrutalist, sidebar nav)
│   ├── style.css               # Page styles incl. .csr-warning badge
│   └── script.js               # Fetch API, render results, CSR warning logic
├── backend/
│   ├── server.js               # Express API server (chat widget)
│   ├── package.json
│   ├── gemini-cache.json       # Dev/test response cache
│   └── test-faq.js             # Live FAQ test suite (node test-faq.js)
└── api/                        # AI Checker FastAPI backend
    ├── main.py                 # FastAPI app — analysis logic + DB logging
    ├── requirements.txt        # fastapi, uvicorn, requests, beautifulsoup4, psycopg2-binary
    └── railway.json            # builder: NIXPACKS, startCommand: python main.py
```

---

## Bilingual SEO (EN + DE)

Site is fully bilingual since 2026-06-09. Every EN page has a `/de/` counterpart.

**URL mapping:**
| EN | DE |
|----|----|
| `/` | `/de/` |
| `/experience/` | `/de/erfahrung/` |
| `/projects/` | `/de/projekte/` |
| `/skills/` | `/de/fahigkeiten/` |
| `/contact/` | `/de/kontakt/` |
| `/articles/` | `/de/artikel/` (Phase 2 — not yet live) |

**Per-page SEO checklist (both EN and DE):**
- `<html lang="en|de">`
- `<link rel="canonical">` pointing to self
- Three `<link rel="alternate" hreflang="en|de|x-default">` tags (bidirectional)
- `<meta property="og:locale" content="en_US|de_DE">` — DE pages use `de_DE`
- Schema.org `inLanguage: "de"` on all DE pages
- sitemap.xml: every URL listed with `<xhtml:link>` hreflang pairs

**When adding new content:**
1. Create EN page/article as usual
2. Add both EN and DE hreflang tags to the EN page head
3. Update sitemap.xml with the EN URL + xhtml:link pairs (pointing to future DE URL)
4. Create DE version (or add to Фаза 2 backlog)
5. DE article URL pattern: `/de/artikel/<slug>/`

**Language switcher:** `js/nav.js` exports `switchLang()` via `langMap` object. To add a new page to the switcher, add both directions to `langMap`.

---

## Frontend

### Design system
- Font: JetBrains Mono (Google Fonts)
- Colors: `--black #111111`, `--white #ffffff`, `--cream #f8f0dc`, `--sky #61b5e8`, `--yellow #f5c84b`, `--pink #efb2d5`
- Style: neobrutalist — 2-3px solid borders, offset box-shadows (`4px 4px 0 black`)

### Pages — shared layout pattern
Every page: sidebar nav (desktop) + `.mobile-bottom-nav` (mobile, fixed bottom, z-index 999)
Mobile breakpoint: `mobile.css` at ≤820px

### Adding a project card (`projects/index.html`)
1. Add `<div class="project-card" data-modal="modal-ID">` with card-meta, card-title, card-excerpt, card-tags, card-footer
2. Add matching `<div class="overlay" id="modal-ID">` modal block
3. Both must exist together

---

## Chat widget (`js/chat-widget.js` + `chat-widget.css`)

### How it works
- IIFE injected via `<script src="/js/chat-widget.js" data-token="..." data-api-url="..." defer>`
- Reads `data-token` and `data-api-url` from its own script tag (with fallback querySelector)
- Injects CSS dynamically, builds DOM, appends to `<body>`

### Key behavior
- Language selection screen first (DE / EN), saved to `sessionStorage`
- History format sent to backend: `{ role: 'user'|'model', parts: [{ text: '...' }] }`
- Max 8 history items (4 rounds), trimmed automatically
- URLs in agent replies rendered as clickable `<a>` links (XSS-safe: escape then linkify)
- **Mobile:** drawer opens full-screen (`top:0 left:0 right:0 bottom:0`), body scroll locked via `body.nbw-no-scroll` class + saved scroll position restore

### Header buttons (left to right inside `.nbw-header-actions`)
1. `nbw-book-btn` — Calendly link, always visible
2. `nbw-lang-toggle` — shows current lang, click resets to language screen
3. `nbw-close-btn` — closes drawer

### Widget token
Token in HTML: `3530a5f865dcb0cc6489f5999cb0bfcb` (public-facing, intentional)

---

## Backend (`backend/server.js`)

### Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Railway health check |
| POST | `/api/chat` | X-Widget-Token | Main chat endpoint |
| GET | `/api/logs` | X-Widget-Token | Last 100 chat logs from Supabase |

### Middleware stack (in order)
1. `helmet()` — security headers
2. CORS whitelist: `azhyshchev.de`, `www.azhyshchev.de` (+ localhost in dev)
3. `rateLimiter` — 25 req/IP/day, 300 global/day (in-memory, resets on restart)
4. `authenticateToken` — checks `X-Widget-Token` header
5. `validateAndSanitizeInput` — validates message/lang/history/sessionId, strips HTML

### AI call
- API: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
- Model: env `OPENROUTER_MODEL` || `google/gemini-3.1-flash-lite`
- `max_tokens: 300`, `temperature: 0.3`
- Timeout: 12 seconds (AbortController)
- History parts validated for structure but NOT for length (AI replies can exceed 500 chars)

### Lead context lookup
When user provides email in chat:
1. Backend extracts email from message or history
2. Queries Supabase `leads` table: `?email=eq.<email>`
3. Injects `[LEAD SPECIFIC AUDIT CONTEXT]` into system prompt with company findings
4. Agent presents findings naturally — does NOT mention pipeline names or database

### Logging (non-blocking, background)
- Telegram: sends each interaction to configured bot/chat
- Supabase: inserts into `chat_logs` table (session_id, ip, lang, user_message, agent_reply, timestamp)
- 90-day retention per Datenschutz

### Dev/test cache
- `NODE_ENV=development` or `test`: uses `gemini-cache.json` to avoid real API calls
- Cache key: `lang:message.toLowerCase()`

### Environment variables on Railway
```
OPENROUTER_API_KEY      required
SECRET_WIDGET_TOKEN     required
SUPABASE_URL            required
SUPABASE_KEY            required
TELEGRAM_BOT_TOKEN      optional
TELEGRAM_CHAT_ID        optional
CORS_ORIGIN             optional (comma-separated extra origins)
OPENROUTER_MODEL        optional override
PORT                    set by Railway automatically
```

---

## Databases

### Supabase (cloud)

| Table | Purpose |
|-------|---------|
| `chat_logs` | All widget conversations (session_id, ip, lang, messages, timestamp) |
| `leads` | B2B outreach leads with audit data (email, company_name, gmaps_score, ai_use_case JSON) |

### Railway PostgreSQL (project: jubilant-tenderness, local to Railway service)

| Table | Purpose |
|-------|---------|
| `ai_checker_logs` | AI Readiness Checker results (url, score, verdict, breakdown JSONB, ip, checked_at) |

Note: `ai_checker_logs` is NOT in Supabase — it lives in Railway Postgres, auto-created on API startup via `CREATE TABLE IF NOT EXISTS`.

---

## Testing

```bash
cd backend
node test-faq.js   # runs 21 live tests against production Railway API
```

Test categories: Normal FAQ, Objections, Off-topic/jailbreak, German language, Multi-turn history

---

## AI Readiness Checker (`ai-checker/` + `api/`)

Live at: `https://azhyshchev.de/ai-checker/`

### What it does
Analyzes any website URL for AI/LLM crawlability. Returns a score 0-100 across 8 metrics.

### Scoring metrics (max 100)
| Metric | Max | Notes |
|--------|-----|-------|
| Agent Readable Content | 20 | Word count in `<main>`/`<article>`/`<body>` |
| Server Side Rendering | 10 | Body text > 500 chars = SSR detected |
| AI Agent Access | 15 | Checks 8 bots in robots.txt (GPTBot, ClaudeBot, etc.) |
| llms.txt | 15 | Checks `/llms.txt` and `/llms-full.txt` |
| Markdown Availability | 15 | Accept-Header negotiation + `/index.md`, `/README.md` |
| Token Economics | 15 | Estimates tokens as `len(text)/4` |
| Performance | 10 | TTFB: <200ms=10, <500ms=7, <1000ms=4, else=0 |
| Sitemap | 10 | robots.txt Sitemap: directive or `/sitemap.xml` |

### CSR detection
Sites using React/Vue/Angular without SSR are detected via empty body + `#root`/`#app`/`#__next`/`#__nuxt` markers.
- `is_csr: true` returned in API response
- Frontend shows yellow `.csr-warning` banner above cards
- Agent Readable Content and SSR cards show specific JS migration advice instead of generic errors
- After the cards: `.csr-explainer` block (id=`csrExplainer`) appears — explains why AI crawlers can't read JS-rendered content, which bots are affected (GPTBot, ClaudeBot, PerplexityBot), which are not (Google-Extended/Gemini), and recommends SSR/SSG migration
- Source cited in explainer: Vercel + MERJ analysis of 500M+ GPTBot requests (zero JS execution detected), SEODiff 1M-domain crawl (97% ghost ratio on pure CSR)

### AI Bot Access — which bots are tracked
8 bots checked in `_check_ai_bot_access`: GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, Bytespider, anthropic-ai, Applebot-Extended

### URL handling
All checks (robots.txt, llms.txt, sitemap, markdown) use `base_origin` (`scheme://netloc`) — not `final_url` which may contain a sub-path after redirects.

### API endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analyze?url=<url>` | Run full analysis, logs to DB |
| GET | `/api/logs?limit=50` | View recent checks from DB |

Base URL: `https://ai-readiness-api-production.up.railway.app`

### Database (Railway PostgreSQL)
Table `ai_checker_logs` — created automatically on startup via `CREATE TABLE IF NOT EXISTS`.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL | PK |
| url | TEXT | Final URL after redirects |
| score | INT | 0-100 |
| verdict | TEXT | Optimal / Needs Improvement / Critical |
| breakdown | JSONB | Full per-metric breakdown |
| ip | TEXT | From x-forwarded-for header |
| user_agent | TEXT | Browser/client |
| checked_at | TIMESTAMPTZ | UTC timestamp |

### Deploy
```bash
cd portfolio/api
railway up   # IMPORTANT: must run from api/ folder, not repo root
```
Railway project: `jubilant-tenderness`, service: `ai-readiness-api`
Environment variable: `DATABASE_URL` — set as reference to the Postgres service in Railway Dashboard.

### No LLM usage
Analysis is pure Python — HTTP requests + BeautifulSoup parsing. Zero token cost.

---

## Calendly

- URL: `https://calendly.com/azhyshchev/30min`
- 30 min, Google Meet, Mon–Thu 10:00–16:00 Munich time
- Linked from: contact page hero-actions + chat widget header button
- Agent mentions it ~every 4 messages (not every reply)

---

## Legal / GDPR

Datenschutzerklärung covers (as of Mai 2026):
- Hosting / server logs
- Google Analytics 4 (G-6FQTTX4FW0)
- Chat widget conversation logging
- B2B cold outreach (Art. 6(1)(f) DSGVO basis, opt-out by email reply, deletion on request)

Cold email template already includes: data source disclosure, legal basis, opt-out instruction, Art. 17 deletion right.

**When someone replies STOP:** manually delete from Supabase `leads` table.
