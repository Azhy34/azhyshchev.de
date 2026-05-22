# Feature Specification: FAQ Chat Agent

**Feature Branch**: `001-faq-chat-agent`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "AI chat widget answering FAQ questions from Munich business owners arriving via email outreach."

---

## Target Audience
The target audience consists of Munich-based business owners and managing directors (*Geschäftsführer*) who arrived at the portfolio website after receiving a highly personalized cold outreach email. They are typically:
- Busy, result-oriented, and value direct, clear communication.
- Interested in AI automation and optimization, but cautious about data privacy, security, and access controls.
- Seeking to understand how Mikhail's services can save them time and money without introducing business risks.

---

## User Scenarios & Testing

### User Story 1 - Multi-language FAQ Interaction (Priority: P1)
As a Munich business owner visiting the website, I want to interact with a chat assistant in my preferred language (German or English) and receive short, accurate answers to common questions about Mikhail's services, background, and process.

**Why this priority**: Crucial for the Minimum Viable Product (MVP). It establishes the primary interaction channel and resolves initial visitor friction.

**Independent Test**: Load the site, open the chat widget, select "Deutsch", type "Wer bist du und warum hast du mir eine E-Mail geschickt?", and verify that the system responds with the correct pre-defined German response in 3-5 sentences, ending with a Call-to-Action.

**Acceptance Scenarios**:
1. **Given** a user has loaded the website, **When** they click the chat widget, **Then** they must be prompted to choose between German and English.
2. **Given** German is selected, **When** the user asks a question, **Then** the response must be entirely in German, professional, 3-5 sentences long, and end with a relevant contact or calendar call-to-action.
3. **Given** English is selected, **When** the user asks a question, **Then** the response must be entirely in English, professional, 3-5 sentences long, and end with a relevant contact or calendar call-to-action.

---

### User Story 2 - Intake Mode & Requirement Gathering (Priority: P2)
As a business owner interested in automations, I want to describe my specific needs directly in the chat, so that the assistant can gather my requirements and register them for Mikhail to review.

**Why this priority**: Generates high-value leads by lowering the barrier to entry for prospective clients who do not want to schedule a call immediately.

**Independent Test**: Initiate a conversation, type "Ich möchte meine Rechnungsstellung automatisieren", verify that the agent asks clarifying questions (industry, volume, systems) and asks for contact information (email), and then displays a completion message confirming Mikhail will follow up.

**Acceptance Scenarios**:
1. **Given** the user describes a project request, **When** the assistant processes the input, **Then** the assistant must switch into intake mode, ask 2-3 short clarifying questions, and explicitly refrain from estimating prices.
2. **Given** the user answers the clarifying questions, **When** the sequence is complete, **Then** the assistant must summarize the request, request the user's email address, and confirm that Mikhail will follow up with a written proposal (*Angebot*).

---

### User Story 3 - Trust and Security Explanations (Priority: P3)
As a cautious business owner, I want to ask about data security, website access, and compliance, so that I can ensure my business data and infrastructure remain safe.

**Why this priority**: Essential for converting B2B leads in Germany, where GDPR compliance and professional safety (limited access rights) are non-negotiable.

**Independent Test**: Ask the assistant "Welche Zugriffsrechte benötigen Sie für meine Website?", and verify that the assistant explains the developer access model, showing that Mikhail is added only as a developer/user with limited rights rather than owner, and that all data remains secure.

**Acceptance Scenarios**:
1. **Given** a user asks about GDPR or data privacy, **When** the system generates a reply, **Then** it must confirm strict adherence to German law, EU hosting, and the provision of a Data Processing Agreement (*AV-Vertrag*).
2. **Given** a user asks about website access, **When** the system generates a reply, **Then** it must clarify that Mikhail works under a limited developer role with no access to financial or customer data.

---

## Edge Cases

- **Language Switching mid-conversation**: If a user switches language or starts typing in German when English was selected, the system should adapt dynamically or continue to respect the initial configuration, maintaining clarity.
- **Unrelated queries**: If a user asks about general news, coding templates, or personal topics unrelated to Mikhail's services, the assistant must politely decline and redirect the user back to Mikhail's professional automation services.
- **Malformed historical logs**: If the client history gets corrupted or exceeds length limits, the system must gracefully fall back to a fresh state without crashing.
- **Exceeding Rate Limits**: If a client sends messages too rapidly or exceeds the global daily cap, the UI must show a helpful fallback message prompting the user to contact Mikhail directly at `azhyshchev@gmail.com`.

---

## Requirements

### Functional Requirements

- **FR-001 (Interface)**: The user interface must be a floating chat widget positioned on the web pages, loading with a slight delay to draw attention without being intrusive.
- **FR-002 (Language Selector)**: The initial state of the chat must offer a clear language choice ("Deutsch" / "English"). This choice must persist across page navigation during the session.
- **FR-003 (Input Constraints)**: The system must enforce a hard character limit of 500 characters on user inputs.
- **FR-004 (Input Sanitization)**: The system must sanitize all input to remove HTML tags and prevent code injection before transmitting.
- **FR-005 (Response Length)**: Assistant replies must be concise (ideally 3-5 sentences) and professional in tone.
- **FR-006 (Knowledge Base)**: The system must answer based on the pre-defined Knowledge Base (Mikhail's background, services, project workflow, security, and FAQs).
- **FR-007 (Call to Action)**: Every closing reply must include a clear, non-mandatory call-to-action (e.g., booking a discovery call, emailing `azhyshchev@gmail.com`, describing a project in the chat, or connecting on LinkedIn).
- **FR-008 (CORS Verification)**: The service backend must verify that the requesting origin matches the authorized host whitelist.
- **FR-009 (Secret Token Verification)**: The client widget must include an authentication token in headers, which the backend verifies before processing the request.
- **FR-010 (IP Rate Limiting)**: The system must limit requests from any single client IP address to a maximum of 25 requests per 24 hours.
- **FR-011 (Global Cap)**: The system must enforce a global daily rate limit of 300 requests across all IPs combined to prevent resource exhaustion.

---

## Knowledge Base Content

### Mikhail's Profile & Services
- **Mikhail Azhyshchev**: Munich-based AI Automation Engineer and entrepreneur. Master's degree in STEM, 15+ years in B2B operations (international logistics, supply chain, trade). Combines deep business process understanding with technical engineering.
- **Business Structure**: Registered German business with USt-ID, issues proper German invoices with Umsatzsteuer, fully GDPR-compliant.
- **Contact Details**: Email: `azhyshchev@gmail.com`, LinkedIn: `https://www.linkedin.com/in/azhyshchev/`, Impressum: `https://azhyshchev.de/impressum/`.
- **Core Services**:
  1. *AI Sales Agents / Chatbots*: 24/7 client-facing tools that qualify leads, answer FAQs, and book meetings.
  2. *Business Process Automation*: Repetitive workflow automations (e.g., invoice processing for German SMEs, saving 8-10 hours/month).
  3. *B2B Lead Generation*: Automated outreach systems optimized for the German market (compliant with §7 UWG).
  4. *Web Optimization (SEO/GEO)*: Optimizing site structures for search engines and AI-based engines (ChatGPT, Perplexity).
  5. *Custom AI Pipelines*: Bespoke Python/TypeScript solutions for business integrations.

### The 4-Point Digital Audit
Mikhail's outreach includes a tailored digital audit of the client's business covering:
1. *Website AI Chatbot*: Checking if the site has 24/7 lead capture.
2. *SEO & HTML Structure*: Local SEO optimizations.
3. *Google Maps Profile*: Optimizing local business map placement.
4. *AI Search Visibility (GEO)*: Ensuring structured markup allows search tools like ChatGPT or Perplexity to find the business.

### FAQ Q&A Database

- **Q**: Who are you and why did you email me?
  **A**: Mikhail Azhyshchev, AI Automation Engineer in Munich. He built an automated system that individually analyzed your website to find specific optimization opportunities. The audit in your email is personalized for your business, not a generic template.
- **Q**: Are you a real German company I can verify?
  **A**: Yes. Registered German business with USt-ID (available on request). Impressum is published at `azhyshchev.de/impressum`. You can verify Mikhail's background on LinkedIn: `linkedin.com/in/azhyshchev`.
- **Q**: How much does it cost?
  **A**: Projects are scoped individually. The cost depends on the complexity of the automated processes. We recommend scheduling a free, non-binding 15-minute call. Following that, you will receive a 1-page concept PDF outlining the scope and fixed-price offer.
- **Q**: I already have a chatbot. What is the difference?
  **A**: Traditional chatbots use rigid decision trees. Mikhail's solutions use language models that understand natural, conversational questions and can handle nuanced requests similar to a human representative.
- **Q**: Do I need technical knowledge?
  **A**: None. You describe your processes in plain language, and Mikhail manages the entire development, integration, and setup.
- **Q**: What about my customer data and GDPR?
  **A**: Fully GDPR-compliant. A standard Data Processing Agreement (*AV-Vertrag*) is signed for all projects. Infrastructure is hosted in the EU, and no data is shared with third parties.
- **Q**: Do you get full website access?
  **A**: No. Mikhail is added as a developer with limited rights. He has no access to customer orders, finances, or payment data. On Google platforms, he is added as a manager/user, never owner, and access can be revoked with a single click.
- **Q**: Is the AI chatbot safe for my business?
  **A**: Yes. The chatbot runs via a script on the frontend and communicates with the processing backend. It is isolated and has no direct access to internal databases, systems, or sensitive records.
- **Q**: How long does implementation take?
  **A**: AI chatbots typically take 1-2 weeks. Full workflow automations take 4-8 weeks, depending on the complexity of target integrations.
- **Q**: Can you connect to my existing systems?
  **A**: Yes, the systems integrate with standard web platforms and business tool APIs. Details are confirmed during the initial scoping call.
- **Q**: I have a small business. Is this worth it?
  **A**: Yes. Automating even a single repetitive process, such as handling customer FAQs outside business hours, routinely saves 5 to 10 hours per week from day one.
- **Q**: Is there a long-term contract?
  **A**: No. Development projects are executed under a fixed-price model. Maintenance agreements are month-to-month and can be cancelled with 30 days notice.
- **Q**: Can I describe my requirements here and get a price?
  **A**: Yes, please outline your workflow or goals directly in this chat. The assistant will collect the details and request your email. Mikhail will review the request personally and email you a customized offer.
- **Q**: What is the next step?
  **A**: You can either book a free 15-minute call or write a request to `azhyshchev@gmail.com` to receive a custom concept draft.

---

## Success Criteria

### Measurable Outcomes
- **SC-001**: Users can choose a language and receive their first FAQ response in under 3 seconds.
- **SC-002**: 100% of invalid origin requests (non-whitelisted hosts) must be rejected with a `403 Forbidden` status.
- **SC-003**: 100% of requests missing the verification header must be blocked with a `401 Unauthorized` status.
- **SC-004**: Clients exceeding the 25 requests/day limit must be throttled with a `429 Too Many Requests` status, protecting the server.
- **SC-005**: All output messages must adhere to the 3-5 sentences limit.

---

## Assumptions

- **A-001**: Users have a browser with JavaScript enabled.
- **A-002**: The static website remains hosted on GitHub Pages or a similar provider that supports static script embedding.
- **A-003**: The backend server is hosted on a platform capable of parsing HTTP headers and performing basic IP/request counting in memory.
- **A-004**: The system's target language processing model receives the structured rules and system instructions on every request payload to maintain context.
