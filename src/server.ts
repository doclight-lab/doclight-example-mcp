import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { withDoclight } from "@doclight/mcp"
import { searchDocs } from "./tools/search-docs.js"
import { getSchema } from "./tools/get-schema.js"
import { listResources } from "./tools/list-resources.js"

const server = new McpServer({
  name: process.env.MCP_SERVER_NAME ?? "docs-search",
  version: "1.0.0",
})

withDoclight(server, {
  apiKey: process.env.DOCLIGHT_API_KEY!,
  projectId: process.env.DOCLIGHT_PROJECT_ID!,
  endpoint: process.env.DOCLIGHT_ENDPOINT,
  environment: process.env.NODE_ENV ?? "development",
})

server.tool(
  "search_docs",
  "Search documentation by query string. Returns matching articles ranked by relevance.",
  {
    query: z.string().describe("Search query"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Maximum results to return (default 5)"),
  },
  async ({ query, limit }) => {
    const results = await searchDocs(query, limit)
    if (results.length === 0) {
      return {
        content: [{ type: "text", text: `No results found for: ${query}` }],
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    }
  },
)

server.tool(
  "get_schema",
  "Get the JSON schema for a named tool. Throws if the tool name is unknown.",
  { tool_name: z.string().describe("Name of the tool to look up") },
  async ({ tool_name }) => {
    const schema = await getSchema(tool_name)
    return {
      content: [{ type: "text", text: JSON.stringify(schema, null, 2) }],
    }
  },
)

server.tool(
  "list_resources",
  "List available documentation resources, optionally filtered by type.",
  {
    type: z
      .enum(["guide", "api", "example"])
      .optional()
      .describe("Filter by resource type (omit to return all)"),
  },
  async ({ type }) => {
    const resources = await listResources(type)
    return {
      content: [{ type: "text", text: JSON.stringify(resources, null, 2) }],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)

process.on("SIGINT", async () => {
  await server.close()
  process.exit(0)
})
