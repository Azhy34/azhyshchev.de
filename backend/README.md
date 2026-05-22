# FAQ Chat Agent Proxy Backend

This is the Express.js proxy backend for the FAQ Chat Agent. It secures communication between the frontend chat widget and the Google Gemini API (`gemini-2.5-flash`), enforces rate limits, sanitizes user inputs, and houses the system instructions for Mikhail's Virtual Assistant.

## 🚀 Features

- **CORS Whitelisting**: Restricted to production (`https://azhyshchev.de`) and development (`http://localhost:5500` via `NODE_ENV === 'development'`).
- **Security Headers**: Leverages `helmet` to establish secure headers.
- **Request Authentication**: Requires the `X-Widget-Token` header matching the server's secret token.
- **Two-Tier In-Memory Rate Limiting**:
  - Max 25 requests per client IP in a rolling 24-hour window.
  - Max 300 global requests across all clients in a rolling 24-hour window.
- **Input Validation & Sanitization**: Enforces strict payload limits (message <= 500 chars, history <= 8 items, lang must be 'de' or 'en') and strips all HTML tags before sending the payload to the Gemini API.
- **Fault Tolerance**: Native Node 18+ `fetch` with a 5-second `AbortController` timeout prevents hung processes.
- **Health Check Endpoint**: `/health` endpoint for uptime monitoring and deployment verification.

## 🛠️ Local Setup

1. **Navigate to the Backend Directory**:
   ```bash
   cd temp_backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in the required details:
   ```bash
   cp .env.example .env
   ```
   Modify `.env`:
   - `PORT`: Server port (default: `3000`).
   - `CORS_ORIGIN`: For production `https://azhyshchev.de` (for development, localhost is handled automatically).
   - `SECRET_WIDGET_TOKEN`: A secure, secret string shared with the frontend widget.
   - `GEMINI_API_KEY`: Your Gemini API Key from Google AI Studio.
   - `NODE_ENV`: Set to `development` to allow localhost CORS.

4. **Run the Server**:
   ```bash
   # Production mode
   npm start
   
   # Development mode
   npm run dev
   ```

## 🧪 Running Verification Tests

We have implemented an automated verification script that tests CORS blocks, token verification, input sanitization, and rate limiters using programmatically managed, mock-stubbed requests to prevent wasting Gemini tokens.

To run the verification suite:
```bash
node tests/verify-limits.js
```

## ☁️ Railway Deployment

Deploying this Express backend to Railway is straightforward:

1. **Initialize Git Repository** (if not already part of your project):
   Make sure you are committing from the workspace containing `temp_backend/` (with `.gitignore` correctly isolating `.env` and `node_modules`).

2. **Create a Railway Project**:
   - Go to [Railway](https://railway.app/) and create a new project.
   - Connect your GitHub repository.

3. **Configure Environment Variables**:
   In your Railway service's **Variables** tab, add:
   - `PORT`: `3000` (Railway will automatically map this to the public domain).
   - `CORS_ORIGIN`: `https://azhyshchev.de`
   - `SECRET_WIDGET_TOKEN`: `your-highly-secure-token`
   - `GEMINI_API_KEY`: `your-google-gemini-api-key`
   - `NODE_ENV`: `production`

4. **Build and Start Commands**:
   Railway will automatically detect `package.json` and use:
   - Build: `npm install`
   - Start: `npm start`

5. **Expose Domain**:
   - Go to your Railway service's **Settings** tab.
   - Click **Generate Domain** or configure your custom subdomain.
   - Copy this URL and update the frontend widget's connection settings.

6. **Monitoring**:
   - Use the Railway logs console to monitor standard output/error streams.
   - Setup a monitor targeting the `/health` endpoint to track service health.
