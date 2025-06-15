#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { ContextDatabase } from "./database.js";

class DevAssistantServer {
  private server: Server;
  private database: ContextDatabase;

  constructor() {
    this.server = new Server(
      {
        name: "dev-assistant-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.database = new ContextDatabase();
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "remember_fact",
            description: "Store a useful fact or insight about the project",
            inputSchema: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description:
                    'Category of the fact (e.g., "architecture", "patterns", "decisions")',
                },
                fact: {
                  type: "string",
                  description: "The fact or insight to remember",
                },
                context: {
                  type: "string",
                  description:
                    "Additional context about when/where this applies",
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Tags to help categorize and find this fact later",
                },
              },
              required: ["category", "fact"],
            },
          },
          {
            name: "recall_facts",
            description: "Retrieve stored facts and insights",
            inputSchema: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "Filter by category",
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Filter by tags",
                },
                search: {
                  type: "string",
                  description: "Search in fact content",
                },
                limit: {
                  type: "number",
                  description:
                    "Maximum number of facts to return (default: 20)",
                  default: 20,
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params as any;

      try {
        switch (name) {
          case "remember_fact":
            if (!args?.category || !args?.fact) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "Category and fact are required"
              );
            }
            const factId = await this.database.storeFact(
              args.category,
              args.fact,
              args.context,
              args.tags || []
            );
            return {
              content: [
                {
                  type: "text",
                  text: `Fact stored successfully with ID: ${factId}`,
                },
              ],
            };

          case "recall_facts":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.database.getFacts(
                      args?.category,
                      args?.tags,
                      args?.search,
                      args?.limit || 20
                    ),
                    null,
                    2
                  ),
                },
              ],
            };

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool ${name} not found`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error}`
        );
      }
    });
  }

  async start() {
    // Initialize database
    await this.database.initialize();

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error("Dev Assistant MCP Server started successfully");
  }

  async stop() {
    await this.database.close();
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.error("Shutting down server...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Shutting down server...");
  process.exit(0);
});

// Start the server
const server = new DevAssistantServer();
server.start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
