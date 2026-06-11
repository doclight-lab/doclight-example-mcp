const SCHEMAS: Record<string, object> = {
  search_docs: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Maximum results to return (default 5)",
      },
    },
    required: ["query"],
  },
  get_schema: {
    type: "object",
    properties: {
      tool_name: {
        type: "string",
        description: "Name of the tool to retrieve the schema for",
      },
    },
    required: ["tool_name"],
  },
  list_resources: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["guide", "api", "example"],
        description: "Filter by resource type (omit to return all)",
      },
    },
    required: [],
  },
}

export async function getSchema(toolName: string): Promise<object> {
  await new Promise((r) => setTimeout(r, 10))

  const schema = SCHEMAS[toolName]
  if (!schema) {
    throw new Error(`unknown tool: ${toolName}`)
  }
  return schema
}
