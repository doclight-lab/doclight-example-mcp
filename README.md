# Doclight Example: MCP Server

## What this is

A working MCP server — "Documentation Search" — instrumented with [`@doclight/mcp`](https://github.com/doclight/doclight/tree/main/packages/mcp). It exposes three tools (`search_docs`, `get_schema`, `list_resources`) and records every tool invocation to Doclight with zero changes to the tool handlers themselves. Use it to verify your Doclight setup, as a reference when instrumenting your own MCP server, or as a demo data source that matches the default seed scenario.

## Prerequisites

- Node.js ≥ 18
- A running Doclight instance — see [main repo setup](https://github.com/doclight/doclight#setup) (`pnpm demo` starts a local stack at `http://localhost:8787`)
- MCP Inspector (optional, for manual testing): `npm install -g @modelcontextprotocol/inspector`

## Setup

```bash
git clone https://github.com/doclight/doclight-example-mcp
cd doclight-example-mcp
cp .env.example .env
# Fill in your DOCLIGHT_API_KEY and DOCLIGHT_PROJECT_ID
npm install
npm run dev
```

## Local development (before npm publish)

If you are working against a local build of the SDK packages:

```bash
# Install yalc globally (one-time)
npm install -g yalc

# In the main doclight repo — build and publish packages to local yalc store:
pnpm sdk:publish:local

# In this repo — link and install:
npm run link:sdk   # yalc add @doclight/core @doclight/node @doclight/mcp
npm install
npm run dev
```

Run `pnpm sdk:publish:local` again any time you change the SDK source.

## What gets tracked automatically

| Event | When | Key fields |
|-------|------|------------|
| `tool_called` | Every tool invocation | `toolName`, `durationMs`, `status` |
| `session_started` | Before each tool runs | `goal` (= tool name) |
| `session_completed` | After each tool finishes | `status` (`success` or `failed`) |

## What NEVER gets tracked

- Tool input values (privacy)
- Tool return values (privacy)
- User queries or content
- Bearer tokens (auto-redacted)

## Verify it's working

1. Start the server: `npm run dev`
2. In another terminal: `npm run inspect`
3. In the Inspector UI, call `search_docs` with `query = "authentication"`
4. Check your dashboard `/sessions` — you should see a new session with a `tool_called` event for `search_docs` within 5 seconds.

<!-- screenshot placeholder -->

## Expected dashboard result

After running for 5 minutes with MCP Inspector:

- `/overview`: sessions > 0, tool calls > 0
- `/tools`: `search_docs`, `get_schema`, `list_resources` visible
- `/sessions`: each Inspector interaction = one session

## Connecting a real agent

```json
// Claude Desktop config (~/.claude/claude_desktop_config.json)
{
  "mcpServers": {
    "docs-search": {
      "command": "npx",
      "args": ["tsx", "/path/to/doclight-example-mcp/src/server.ts"],
      "env": {
        "DOCLIGHT_API_KEY": "your-key",
        "DOCLIGHT_PROJECT_ID": "your-project",
        "DOCLIGHT_ENDPOINT": "http://localhost:8787"
      }
    }
  }
}
```

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `DOCLIGHT_API_KEY not set` | Missing env var | Copy `.env.example` → `.env` and fill in values |
| `Connection refused :8787` | API not running | `cd ../doclight && pnpm demo` |
| `tool_called` events missing | `withDoclight` not called before tools | Check `server.ts` — `withDoclight(server, {...})` must come before tool registrations |
| `unknown tool: <name>` | `get_schema` called with an unregistered name | Only `search_docs`, `get_schema`, `list_resources` are valid tool names |

## Do not

- Do not add `DOCLIGHT_API_KEY` to source control
- Do not call `withDoclight()` more than once per server instance
- Do not instrument tool handlers manually — `withDoclight()` handles every handler automatically

## How instrumentation works

Two lines in `src/server.ts` add full observability:

```typescript
import { withDoclight } from "@doclight/mcp"

withDoclight(server, {
  apiKey: process.env.DOCLIGHT_API_KEY!,
  projectId: process.env.DOCLIGHT_PROJECT_ID!,
  endpoint: process.env.DOCLIGHT_ENDPOINT,
})
```

`withDoclight` monkey-patches `server.tool()` so every handler registered after the call is automatically wrapped with a session + `trackToolCall`. It also wraps any tools registered *before* the call, making call order irrelevant.
