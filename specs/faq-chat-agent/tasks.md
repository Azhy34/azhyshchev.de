# Actionable Task List: FAQ Chat Agent

This task list breaks down the implementation of the FAQ Chat Agent into actionable steps, tracking dependencies and files to be modified.

---

## Phase 1: Chat Widget UI (Frontend)

Goal: Build a responsive, user-friendly chat UI widget that loads with a slight delay, manages language state, sanitizes user input, and maintains conversation history.

- [x] **Task 1.1**: Create Chat Widget CSS Stylesheet
  - **Target File**: `public/css/chat-widget.css`
  - **Description**: Add CSS rules for the floating chat bubble (bottom-right), sliding chat container drawer, language selection screen buttons, message bubbles (user vs. assistant), input fields, character counter, and a smooth typing indicator animation.
  - **Dependencies**: None
  - **Parallel Execution**: [P]

- [x] **Task 1.2**: Implement Chat Widget Core Logic
  - **Target File**: `public/js/chat-widget.js`
  - **Description**: Implement Javascript to:
    - Delay loading the widget by 2 seconds after page load.
    - Show initial screen asking for "Deutsch" or "English".
    - Save language selection in `sessionStorage` (for persistence across navigations).
    - Handle user typing: enforce the 500-character limit dynamically.
    - Strip HTML tags from input string before sending to backend.
    - Manage an in-memory conversation history array (up to 8 messages total / 4 conversation rounds).
    - Show typing indicator when awaiting a response.
  - **Dependencies**: None
  - **Parallel Execution**: [P]

- [x] **Task 1.3**: Embed Widget into Portfolio HTML
  - **Target File**: `public/index.html`
  - **Description**: Include references to `chat-widget.css` and `chat-widget.js` at the bottom of the main HTML file. Add a container div where the widget will mount, or have JavaScript inject it dynamically.
  - **Dependencies**: Task 1.1, Task 1.2

### 🔍 Phase 1 Checkpoint Verification
1. Load `public/index.html` locally.
2. Confirm the chat launcher button appears after 2 seconds.
3. Click the launcher and verify the language selector screen displays.
4. Select a language and confirm the interface switches to the chat screen.
5. Attempt to paste text longer than 500 characters and confirm it is blocked or trimmed.

---

## Phase 2: Railway Proxy Backend

Goal: Develop the Express.js proxy server with input verification, custom rate-limiting middleware, CORS restriction, and Gemini API integration using native fetch requests.

- [x] **Task 2.1**: Initialize Express Project
  - **Target File**: `backend/package.json`
  - **Description**: Create `package.json` with dependencies `express`, `cors`, `dotenv`, and `helmet`. Include a dev start script using `nodemon`.
  - **Dependencies**: None
  - **Parallel Execution**: [P]

- [x] **Task 2.2**: Configure Environment Variables & Basic Server
  - **Target Files**: `backend/.env.example`, `backend/.gitignore`, `backend/server.js`
  - **Description**: 
    - Set up `.env.example` with placeholders for `PORT`, `CORS_ORIGIN`, `SECRET_WIDGET_TOKEN`, and `GEMINI_API_KEY`.
    - Setup `.gitignore` to prevent committing `node_modules` or `.env`.
    - Create `server.js` establishing an Express server with JSON parser, `helmet()`, and CORS configuration whitelisting `process.env.CORS_ORIGIN`.
  - **Dependencies**: Task 2.1

- [x] **Task 2.3**: Implement Request Validation and Input Sanitization Middleware
  - **Target File**: `backend/server.js`
  - **Description**: Create middleware to validate incoming payloads:
    - Reject requests immediately with `400 Bad Request` if `message` is missing/longer than 500 characters, if `lang` is not `"de"` or `"en"`, or if `history` exceeds 8 items.
    - Strip all HTML tags from the message and history items using regular expressions.
  - **Dependencies**: Task 2.2

- [x] **Task 2.4**: Implement Custom In-Memory Rate Limiting
  - **Target File**: `backend/server.js`
  - **Description**: Implement a middleware tracking IP addresses and global counts:
    - Keep request timestamps in memory. Evict timestamps older than 24 hours.
    - Limit individual IP to 25 requests in 24 hours (return `429 Too Many Requests` on breach).
    - Limit global requests to 300 in 24 hours (return `503 Service Unavailable` on breach).
  - **Dependencies**: Task 2.2

- [x] **Task 2.5**: Integrate Gemini API with System Prompt and Knowledge Base
  - **Target File**: `backend/server.js`
  - **Description**: Add route `POST /api/chat`. Inside the handler:
    - Validate `X-Widget-Token` header against `process.env.SECRET_WIDGET_TOKEN` (return `401 Unauthorized` on mismatch).
    - Assemble the LLM prompt combining the system instruction (professional automation engineer persona, knowledge base containing services, audit structure, and FAQ database), language selection, conversation history, and the user's current message.
    - Call the Gemini API via native `fetch` (Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...`).
    - Use `AbortController` to set a 5-second timeout on the request.
    - Parse, sanitize, and return the generated answer to the client.
  - **Dependencies**: Task 2.3, Task 2.4

### 🔍 Phase 2 Checkpoint Verification
1. Start the backend locally with `npm run dev` on `http://localhost:3000`.
2. Send a POST request to `http://localhost:3000/api/chat` using `curl` or Postman.
3. Verify that sending a request without the `X-Widget-Token` header returns `401 Unauthorized`.
4. Verify that sending a request with an Origin header not in the CORS list (e.g. `Origin: http://evil.com`) returns `403 Forbidden`.
5. Send a request with a valid token and verify it returns `200 OK` and a structured FAQ response in < 3s.

---

## Phase 3: Integration & Security

Goal: Connect the frontend widget to the backend proxy, handle errors in the UI gracefully, and document deployment.

- [x] **Task 3.1**: Connect Frontend to Proxy API
  - **Target File**: `public/js/chat-widget.js`
  - **Description**: 
    - Configure the fetch destination in `chat-widget.js` to target the local backend port (`http://localhost:3000/api/chat`) for dev, and read a configurable/production endpoint for deployment.
    - Send `X-Widget-Token` in headers and payload containing user input, lang, and history.
    - Update UI: on 200, display the response; on 429/503/errors, display the custom error message suggesting emailing `azhyshchev@gmail.com`.
  - **Dependencies**: Task 1.2, Task 2.5

- [x] **Task 3.2**: Prepare Deployment Files
  - **Target File**: `backend/README.md`
  - **Description**: Document how to configure and deploy the backend on Railway: specifying environment variables, health check paths, and how to whitelist production CORS origin (`https://azhyshchev.de`).
  - **Dependencies**: Task 2.5

### 🔍 Phase 3 Checkpoint Verification
1. Start both backend and frontend locally.
2. Open local frontend site, choose English, and type "Who are you and why did you email me?".
3. Verify that the request is successfully proxied to the backend, Gemini generates a response, and the frontend displays the response cleanly.
4. Verify that conversation history works (e.g., ask "Are you registered in Germany?", followed by "What was my previous question?"). The bot should recall the context.

---

## Phase 4: Testing & Verification

Goal: Run automated limits testing and manually verify edge-case behaviors (GDPR, website access, and Intake Mode).

- [x] **Task 4.1**: Create Automated Limits and Security Verification Script
  - **Target File**: `backend/tests/verify-limits.js`
  - **Description**: Write a Node script using native `fetch` to run a battery of tests against a running local backend server:
    - Assert that 26 sequential requests from one IP trigger `429 Too Many Requests` on the 26th call.
    - Assert that HTML injection in payload is sanitized.
    - Assert that missing token triggers `401`.
  - **Dependencies**: Task 2.5
  - **Parallel Execution**: [P]

- [x] **Task 4.2**: Manually Verify Intake Mode and GDPR Compliance FAQ
  - **Target File**: `public/js/chat-widget.js` / manual inspection
  - **Description**:
    - Interact with chatbot, type: "Ich möchte ein Automatisierungsprojekt". Check that it enters intake mode, asks clarifying questions, and asks for an email.
    - Type: "Wie steht es um die DSGVO?". Check that it explains EU hosting and the provision of an AV-Vertrag.
    - Type: "Muss ich Ihnen vollen Zugriff auf мои сайт?". Check that it explains the limited developer access model.
  - **Dependencies**: Task 3.1

### 🔍 Phase 4 Checkpoint Verification
1. Run `node backend/tests/verify-limits.js`. Confirm all security limits tests report success.
2. Complete a full intake funnel in the chat interface and verify it concludes with a request for email and confirmation that Mikhail will follow up.
