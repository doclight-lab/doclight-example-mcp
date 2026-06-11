export interface Doc {
  id: string
  title: string
  content: string
  type: "guide" | "api" | "example"
  tags: string[]
}

export const DOCS: Doc[] = [
  {
    id: "guide-auth-overview",
    title: "Authentication Overview",
    content:
      "Doclight uses API key authentication. Pass your key in the Authorization header as a Bearer token. Keys are scoped to a project and can be rotated from the dashboard. Never commit keys to source control.",
    type: "guide",
    tags: ["authentication", "api-key", "security", "getting-started"],
  },
  {
    id: "guide-sessions",
    title: "Sessions and Tool Calls",
    content:
      "A session represents one agent interaction from start to finish. Each tool call inside a session is recorded with its duration and outcome. Sessions are automatically closed after 30 minutes of inactivity.",
    type: "guide",
    tags: ["sessions", "tool-calls", "observability", "concepts"],
  },
  {
    id: "guide-sdk-install",
    title: "Installing the Node.js SDK",
    content:
      "Install @doclight/node and @doclight/mcp from npm. Configure with your API key and project ID. The SDK buffers events and sends them in batches every 3 seconds, so your tools are not blocked by network I/O.",
    type: "guide",
    tags: ["sdk", "installation", "node", "npm"],
  },
  {
    id: "guide-mcp-integration",
    title: "Instrumenting an MCP Server",
    content:
      "Call withDoclight(server, config) immediately after creating your McpServer. All tools registered before or after the call are automatically instrumented. Tool inputs and outputs are never sent to Doclight.",
    type: "guide",
    tags: ["mcp", "instrumentation", "withDoclight", "privacy"],
  },
  {
    id: "guide-dashboard",
    title: "Reading the Dashboard",
    content:
      "The /overview page shows sessions and tool calls over time. /tools shows per-tool success rates and latency percentiles. /sessions lists individual agent interactions and their tool call sequences.",
    type: "guide",
    tags: ["dashboard", "overview", "tools", "sessions", "analytics"],
  },
  {
    id: "api-ingest",
    title: "POST /v1/events/batch",
    content:
      "Ingest endpoint. Accepts a JSON body with schemaVersion, projectId, sdk, and events[]. Requires Bearer token authentication. Returns {accepted: N, rejected: M}. Rate limited to 1000 requests/min per project.",
    type: "api",
    tags: ["api", "ingest", "events", "batch", "rest"],
  },
  {
    id: "api-sessions",
    title: "GET /v1/sessions",
    content:
      "List sessions for the authenticated project. Supports ?from=ISO8601&to=ISO8601&limit=N&cursor=string pagination. Returns sessions ordered by startedAt descending.",
    type: "api",
    tags: ["api", "sessions", "pagination", "rest"],
  },
  {
    id: "api-tools",
    title: "GET /v1/tools/stats",
    content:
      "Returns per-tool aggregated statistics: call count, success rate, p50/p95/p99 latency, and error breakdown by errorType. Supports ?window=1h|24h|7d.",
    type: "api",
    tags: ["api", "tools", "statistics", "latency", "rest"],
  },
  {
    id: "api-projects",
    title: "Project Management API",
    content:
      "Create, update, and delete projects via /v1/projects. Each project has an id, name, and one or more API keys. Use the dashboard UI for day-to-day key rotation; use the API for automation.",
    type: "api",
    tags: ["api", "projects", "management", "api-keys"],
  },
  {
    id: "example-node-basic",
    title: "Basic Node.js Example",
    content:
      "Create a Doclight client with createDoclight({apiKey, projectId}). Start a session with client.startSession('goal'). Track tool calls with client.trackToolCall({sessionId, toolName, status, durationMs}). End with client.endSession(sessionId, 'success').",
    type: "example",
    tags: ["example", "node", "sdk", "basic", "typescript"],
  },
  {
    id: "example-mcp-server",
    title: "MCP Server with withDoclight",
    content:
      "See the doclight-example-mcp repository for a complete working example. It implements a Documentation Search server with three tools and full Doclight instrumentation using the withDoclight helper.",
    type: "example",
    tags: ["example", "mcp", "withDoclight", "reference"],
  },
  {
    id: "example-error-handling",
    title: "Error Types and Tracking",
    content:
      "When a tool fails, the SDK records status:failed. Include an errorType string in your trackToolCall call (e.g. 'no_results', 'rate_limit_exceeded', 'missing_required_param') to see error breakdowns per tool in the dashboard.",
    type: "example",
    tags: ["example", "errors", "error-types", "debugging", "sdk"],
  },
  {
    id: "guide-privacy",
    title: "Privacy and Data Handling",
    content:
      "Tool inputs and outputs are never sent to Doclight. Only metadata is collected: tool name, duration, status, error type. Bearer tokens in any string field are automatically redacted before transmission.",
    type: "guide",
    tags: ["privacy", "security", "data", "redaction"],
  },
  {
    id: "guide-self-hosting",
    title: "Self-Hosting Doclight",
    content:
      "Clone the repository and run pnpm demo to start a local stack. The API runs on port 8787, the dashboard on port 3000. Set DOCLIGHT_ENDPOINT=http://localhost:8787 in your SDK config to point at the local instance.",
    type: "guide",
    tags: ["self-hosting", "local", "setup", "docker"],
  },
]
