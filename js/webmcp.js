/**
 * WebMCP Runtime & Agent-Ready Web Polyfill for azhyshchev.de
 * Implements WebMCP (Model Context Protocol for Browsers) & A2A Discovery.
 * Integrates directly with Google ADK Multi-Agent & Vertex AI RAG backend.
 * Reference: Google Cloud Tech - Building Agent-Ready Applications with WebMCP & ADK
 */

(function (global) {
  'use strict';

  // Prevent double initialization
  if (global.__WebMCP_Initialized__) {
    return;
  }
  global.__WebMCP_Initialized__ = true;

  // Backend API URL resolver
  const getApiUrl = () => {
    const hostname = global.location ? global.location.hostname : '';
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return 'http://localhost:8080/api/chat';
    }
    return 'https://azhy-ai-consultant-377331886416.europe-west3.run.app/api/chat';
  };

  const API_ENDPOINT = getApiUrl();
  const WIDGET_TOKEN = 'dev-token-default-12345';
  const AGENT_CARD_URL = 'https://azhyshchev.de/.well-known/agent-card.json';
  const GOOGLE_A2A_REGISTRY_ID = 'de.azhyshchev.azhy_ai_consultant';

  // Candidate Structured Knowledge Base
  const CANDIDATE_PROFILE = {
    name: "Mikhail Azhyshchev",
    title: "AI Engineer & B2B Solutions Architect",
    location: "Frankfurt am Main, Germany / Remote",
    website: "https://azhyshchev.de",
    linkedin: "https://www.linkedin.com/in/mikhail-azhyshchev/",
    calendly: "https://calendly.com/azhyshchev/30min",
    email: "azhyshchev@gmail.com",
    agent_card_url: AGENT_CARD_URL,
    a2a_package_id: GOOGLE_A2A_REGISTRY_ID,
    summary: "Senior AI Engineer specializing in Google ADK Multi-Agent swarms, WebMCP / Agent-Ready interfaces, Vertex AI Search RAG pipelines, and B2B automation systems.",
    core_pillars: [
      "Google ADK & Multi-Agent Swarms (Root Coordinator + Subagents)",
      "WebMCP & Agent-Ready Web Architecture (Model Context Protocol in Browser)",
      "Production Hybrid RAG (Vertex AI Search + Grounded Knowledge Base on Cloud Run)",
      "B2B Automation & Lead Qualification Systems"
    ]
  };

  const SKILLS_CATALOG = {
    ai_agents: [
      { name: "Google Agent Development Kit (ADK)", level: "Expert", description: "Multi-agent coordinator, subagent routing, tool calling, two-layer shields." },
      { name: "WebMCP & Model Context Protocol", level: "Expert", description: "Agent-Ready browser interfaces, client-side MCP discovery, tool registration." },
      { name: "Autonomous Workflows & Swarms", level: "Expert", description: "Goal-driven execution, state management, deterministic guardrails." }
    ],
    cloud_rag: [
      { name: "Google Cloud Platform (GCP)", level: "Advanced", description: "Cloud Run serverless containers, Secret Manager, IAM ADC, Cloud Firestore." },
      { name: "Vertex AI & Hybrid RAG", level: "Advanced", description: "Vertex AI Search data stores, grounded vector retrieval, cost optimization." },
      { name: "FastAPI & Python Microservices", level: "Expert", description: "Async REST APIs, Pydantic v2 schemas, automated eval benchmarks (14/14 pass)." }
    ],
    b2b_automation: [
      { name: "B2B Lead Discovery & Scraping", level: "Expert", description: "Google Maps MCP, Impressum extraction, company enrichment pipelines." },
      { name: "Invoice Processing & PDF Automation", level: "Expert", description: "Gemini API extraction, DATEV/ERP integration, zero manual entry." }
    ]
  };

  const PROJECTS_CATALOG = [
    {
      id: "azhy-ai-consultant",
      title: "Google ADK Multi-Agent Sales Consultant with Vertex AI RAG",
      description: "Production Multi-Agent system on GCP Cloud Run orchestrating Root Coordinator, Skills Expert, Case Studies, and Lead Capture subagents with Vertex AI RAG and Telegram alerts.",
      url: "https://azhyshchev.de",
      agent_card: AGENT_CARD_URL,
      technologies: ["Google ADK", "Python", "FastAPI", "Cloud Run", "Firestore", "Vertex AI Search RAG", "Telegram API"]
    },
    {
      id: "webmcp-agent-ready-web",
      title: "WebMCP Agent-Ready Website Integration",
      description: "Browser-native Model Context Protocol runtime turning azhyshchev.de into a self-describing, tool-executable interface for autonomous AI agents.",
      url: "https://azhyshchev.de/.well-known/agent-card.json",
      technologies: ["WebMCP", "JavaScript", "JSON-RPC", "DOM Discovery", "A2A Protocol"]
    },
    {
      id: "b2b-lead-generation-mcp",
      title: "Automated B2B Lead Generation & Audit Pipeline",
      description: "Autonomous lead generation system scraping local businesses, extracting decision makers and generating customized AI readiness audits.",
      url: "https://azhyshchev.de/projects/",
      technologies: ["MCP", "Python", "Google Maps API", "Firecrawl", "Gemini 2.5"]
    }
  ];

  /**
   * WebMCP ModelContext Class
   */
  class ModelContext {
    constructor() {
      this.version = "0.3.0";
      this.protocol = "WebMCP";
      this.tools = new Map();
      this._initDefaultTools();
    }

    /**
     * Register a new tool
     * @param {Object} toolDefinition - { name, description, inputSchema, handler }
     */
    registerTool(toolDefinition) {
      if (!toolDefinition || !toolDefinition.name || typeof toolDefinition.handler !== 'function') {
        throw new Error("Invalid tool definition. 'name' and 'handler' function are required.");
      }

      this.tools.set(toolDefinition.name, {
        name: toolDefinition.name,
        description: toolDefinition.description || "",
        inputSchema: toolDefinition.inputSchema || { type: "object", properties: {} },
        handler: toolDefinition.handler
      });

      console.info(`[WebMCP] Tool registered: ${toolDefinition.name}`);
    }

    /**
     * List all available tools with schemas
     */
    listTools() {
      const toolList = [];
      for (const [name, tool] of this.tools.entries()) {
        toolList.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      }
      return toolList;
    }

    /**
     * Execute a tool by name
     * @param {string} toolName 
     * @param {Object} args 
     * @returns {Promise<any>}
     */
    async callTool(toolName, args = {}) {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`[WebMCP] Tool not found: "${toolName}". Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
      }

      try {
        console.info(`[WebMCP] Calling tool "${toolName}" with args:`, args);
        const result = await tool.handler(args);
        return {
          status: "success",
          tool: toolName,
          result: result
        };
      } catch (error) {
        console.error(`[WebMCP] Tool execution error in "${toolName}":`, error);
        return {
          status: "error",
          tool: toolName,
          error: error.message || String(error)
        };
      }
    }

    /**
     * Get Discovery Manifest for Autonomous Agents
     */
    getManifest() {
      return {
        protocol: this.protocol,
        version: this.version,
        agentCardUrl: AGENT_CARD_URL,
        a2aRegistryPackage: GOOGLE_A2A_REGISTRY_ID,
        backendEndpoint: API_ENDPOINT,
        ragEngine: "Vertex AI Search RAG + Cloud Run (europe-west3)",
        tools: this.listTools()
      };
    }

    /**
     * Initialize standard suite of candidate tools
     */
    _initDefaultTools() {
      // 1. Get Candidate Profile & Google Agent Card Info
      this.registerTool({
        name: "get_candidate_profile",
        description: "Retrieves Mikhail Azhyshchev's core profile, positioning, contact links, and Agent Card metadata.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        },
        handler: async () => CANDIDATE_PROFILE
      });

      // 2. Get Candidate Skills
      this.registerTool({
        name: "get_candidate_skills",
        description: "Retrieves verified technical skills and proficiencies filtered by category (ai_agents, cloud_rag, b2b_automation, or all).",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["ai_agents", "cloud_rag", "b2b_automation", "all"],
              description: "Category of skills to filter by. Defaults to 'all'."
            }
          }
        },
        handler: async (args) => {
          const category = args.category || "all";
          if (category === "all") {
            return SKILLS_CATALOG;
          }
          return SKILLS_CATALOG[category] || { message: `Category "${category}" not found. Available: ai_agents, cloud_rag, b2b_automation.` };
        }
      });

      // 3. Get Project Case Study
      this.registerTool({
        name: "get_project_case_study",
        description: "Retrieves detailed case studies of Mikhail's flagship AI projects, architecture, and technology stacks.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Optional project ID (e.g., 'azhy-ai-consultant', 'webmcp-agent-ready-web', 'b2b-lead-generation-mcp'). Leave empty for all."
            }
          }
        },
        handler: async (args) => {
          if (!args.projectId) {
            return PROJECTS_CATALOG;
          }
          const project = PROJECTS_CATALOG.find(p => p.id === args.projectId);
          return project || { message: `Project "${args.projectId}" not found. Available: ${PROJECTS_CATALOG.map(p => p.id).join(', ')}` };
        }
      });

      // 4. Ask AI Consultant Live (Calls Cloud Run ADK Multi-Agent Endpoint with Vertex AI RAG)
      this.registerTool({
        name: "ask_consultant_live",
        description: "Direct bridge to Mikhail's live Google ADK Multi-Agent AI Consultant on Google Cloud Run. Answers technical questions grounded in Vertex AI Search RAG.",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "User question or inquiry for the AI Consultant."
            },
            language: {
              type: "string",
              enum: ["en", "de"],
              description: "Preferred response language ('en' or 'de'). Defaults to 'en'."
            }
          },
          required: ["message"]
        },
        handler: async (args) => {
          if (!args.message) {
            throw new Error("Argument 'message' is required.");
          }

          const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Widget-Token": WIDGET_TOKEN
            },
            body: JSON.stringify({
              message: args.message,
              language: args.language || "en",
              session_id: "webmcp_" + Math.random().toString(36).substring(2, 10),
              history: []
            })
          });

          if (!response.ok) {
            throw new Error(`Backend returned HTTP status ${response.status}`);
          }

          const data = await response.json();
          return {
            reply: data.reply || data.response || "",
            grounding: data.grounding || null,
            meta: {
              source: "Google Cloud Run (ADK Multi-Agent)",
              region: "europe-west3",
              rag: "Vertex AI Search RAG"
            }
          };
        }
      });

      // 5. Book Intro Call / Direct Contact
      this.registerTool({
        name: "book_intro_call",
        description: "Generates Calendly 30-min booking link and direct contact channels for scheduling an intro call with Mikhail Azhyshchev.",
        inputSchema: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Brief note or topic of discussion."
            }
          }
        },
        handler: async (args) => {
          return {
            calendly_url: CANDIDATE_PROFILE.calendly,
            email: CANDIDATE_PROFILE.email,
            linkedin: CANDIDATE_PROFILE.linkedin,
            instructions: "You can book directly via Calendly or email Mikhail with topic: " + (args.reason || "AI Engineering Consultation")
          };
        }
      });
    }
  }

  // Instantiate singleton ModelContext
  const modelContextInstance = new ModelContext();

  // Export to standard locations
  global.modelContext = modelContextInstance;
  global.webMCP = modelContextInstance;
  if (global.navigator) {
    global.navigator.modelContext = modelContextInstance;
  }

  // Dispatch standard ready event for browser extensions / agent injectors
  if (typeof global.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    const readyEvent = new CustomEvent('modelcontextready', {
      detail: {
        version: modelContextInstance.version,
        tools: modelContextInstance.listTools(),
        manifest: modelContextInstance.getManifest()
      }
    });
    global.dispatchEvent(readyEvent);
  }

  console.info(`[WebMCP] Agent-Ready Web Runtime initialized on azhyshchev.de (v${modelContextInstance.version}). Available tools: ${modelContextInstance.listTools().length}`);

})(typeof window !== 'undefined' ? window : globalThis);
