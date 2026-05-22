# FAQ Chat Agent Swarm Constitution

## Core Principles

### I. Think Before Coding (Andrej Karpathy Guidelines)
State assumptions explicitly. Surface trade-offs and interpretations before selecting a solution path. Push back if a simpler approach exists. Do not write any code until the specifications are locked and approved.

### II. Simplicity First & Surgical Changes
Implement the absolute minimum logic required for the task. Avoid speculative features or unnecessary abstractions. When making code changes, touch only the lines directly related to the task, matching the existing code style perfectly. Avoid refactoring adjacent code.

### III. Goal-Driven Execution & Test-First
Define success criteria and verification steps before implementing features. Loop through implementation and validation cycles until the target criteria are met. Use explicit multi-step plans for any complex tasks.

### IV. Strict Separation of Concerns (spec.md vs plan.md)
We maintain a clean separation between Product (What & Why) and Engineering (How):
- **spec.md** remains strictly technology-agnostic. It contains no implementation details, library references, or frameworks.
- **plan.md** houses all engineering plans, technology choices, architectures, and testing configurations.
Mixing these concerns is a blocker for merging specifications.

---

## Security & Privacy Constraints

### I. Zero Leak Policy
NEVER print, commit, or log raw secrets, API keys, tokens, or credentials to any console, chat output, or repository. All configurations must pull secrets from environment variables. If reading configuration or environment files, always pipe to a redaction filter and mask values with `[REDACTED]`.

### II. Origin Whitelist (CORS)
The FAQ agent's backend server must strictly restrict Cross-Origin Resource Sharing (CORS) to:
- Production: `https://azhyshchev.de`
- Development: `http://localhost:5500` (strictly for local debugging; must be disabled in production).
All other origins must receive a `403 Forbidden` response.

### III. Secret Header Validation (Widget Token)
To prevent scraping and unauthorized API usage:
- Every client-side request from the static widget must include a custom header: `X-Widget-Token`.
- The backend proxy must validate this token against a server-side environment secret.
- Invalid or missing tokens must immediately return a `401 Unauthorized` response.

### IV. Rate Limiting and Billing Protection
To safeguard against abuse and budget overflow, the application must enforce two independent rate-limiting tiers:
1. **IP-Based Limit**: Under 25 requests per individual IP address in any rolling 24-hour window. Reset counter daily. Return `429 Too Many Requests` on violation.
2. **Global Daily Cap**: Under 300 total requests across all users in any rolling 24-hour window. Return `503 Service Unavailable` on violation.

### V. Input Sanitization & Validation
All user inputs must undergo strict validation before processing:
- The user message must be a string with a maximum length of 500 characters.
- The language parameter must be strictly restricted to `"de"` or `"en"`.
- The conversation history array must contain at most 8 messages, with each message constrained to a maximum of 500 characters.
- All input strings must have HTML tags stripped and characters sanitized to prevent Cross-Site Scripting (XSS) and injection attacks.

---

## Development Workflow

### I. Specification and Review
Every new feature or capability must start with an updated or new Functional Specification (`spec.md`) and a corresponding Implementation Plan (`plan.md`). No coding starts without explicit review of the specs.

### II. Code Integrity & Verification
Each implemented component must be verified against the acceptance criteria defined in the functional specification. Local scripts or curl commands should be used to simulate client traffic and test the boundaries of CORS, tokens, and rate limits.

---

## Governance

- This Constitution is the ultimate source of truth for swarm operations and takes precedence over temporary development preferences.
- Any modification to these security constraints or principles requires manual review and amendment of this document.

**Version**: 1.0.0 | **Ratified**: 2026-05-22 | **Last Amended**: 2026-05-22
