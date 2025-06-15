#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { FileWatcher } from "./file-watcher.js";
import { ContextDatabase } from "./database.js";
import { GitAnalyzer } from "./git-analyzer.js";
import { ProjectAnalyzer } from "./project-analyzer.js";

class DevAssistantServer {
  private server: Server;
  private fileWatcher: FileWatcher;
  private database: ContextDatabase;
  private gitAnalyzer: GitAnalyzer;
  private projectAnalyzer: ProjectAnalyzer;
  private projectPath: string;

  constructor() {
    this.server = new Server(
      {
        name: "dev-assistant-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Get project path from environment or use current directory
    // Handle case where PROJECT_PATH might be a placeholder like ${workspaceFolder}
    let projectPath = process.env.PROJECT_PATH || process.cwd();

    // If PROJECT_PATH contains ${workspaceFolder} or similar placeholders, fall back to cwd
    if (projectPath.includes("${")) {
      projectPath = process.cwd();
      console.error(`Warning: Using fallback project path: ${projectPath}`);
    }

    this.projectPath = projectPath;

    this.database = new ContextDatabase();
    this.fileWatcher = new FileWatcher(this.projectPath, this.database);
    this.gitAnalyzer = new GitAnalyzer(this.projectPath);
    this.projectAnalyzer = new ProjectAnalyzer(this.projectPath);

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_project_structure",
            description: "Get the file and folder structure of the project",
            inputSchema: {
              type: "object",
              properties: {
                maxDepth: {
                  type: "number",
                  description: "Maximum depth to traverse (default: 3)",
                  default: 3,
                },
                includeHidden: {
                  type: "boolean",
                  description: "Include hidden files and folders",
                  default: false,
                },
              },
            },
          },
          {
            name: "search_code",
            description: "Search for code patterns across the project",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query (supports regex)",
                },
                fileExtensions: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    'File extensions to search in (e.g., [".ts", ".js"])',
                },
                caseSensitive: {
                  type: "boolean",
                  description: "Case sensitive search",
                  default: false,
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_file_content",
            description: "Get the content of a specific file",
            inputSchema: {
              type: "object",
              properties: {
                filePath: {
                  type: "string",
                  description: "Path to the file relative to project root",
                },
              },
              required: ["filePath"],
            },
          },
          {
            name: "analyze_recent_changes",
            description: "Analyze recent git changes and commits",
            inputSchema: {
              type: "object",
              properties: {
                days: {
                  type: "number",
                  description: "Number of days to look back (default: 7)",
                  default: 7,
                },
                maxCommits: {
                  type: "number",
                  description:
                    "Maximum number of commits to analyze (default: 20)",
                  default: 20,
                },
              },
            },
          },
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
          {
            name: "get_dependencies",
            description: "Analyze project dependencies and imports",
            inputSchema: {
              type: "object",
              properties: {
                includeDevDeps: {
                  type: "boolean",
                  description: "Include development dependencies",
                  default: true,
                },
              },
            },
          },
        ],
      };
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "file://project-structure",
            mimeType: "application/json",
            name: "Project Structure",
            description: "Current project file structure",
          },
          {
            uri: "file://recent-changes",
            mimeType: "application/json",
            name: "Recent Changes",
            description: "Recent file changes and modifications",
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params as any;

      try {
        switch (name) {
          case "get_project_structure":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.projectAnalyzer.getProjectStructure(
                      args?.maxDepth || 3,
                      args?.includeHidden || false
                    ),
                    null,
                    2
                  ),
                },
              ],
            };

          case "search_code":
            if (!args?.query) {
              throw new McpError(ErrorCode.InvalidParams, "Query is required");
            }
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.projectAnalyzer.searchCode(
                      args.query,
                      args.fileExtensions,
                      args.caseSensitive || false
                    ),
                    null,
                    2
                  ),
                },
              ],
            };

          case "get_file_content":
            if (!args?.filePath) {
              throw new McpError(
                ErrorCode.InvalidParams,
                "File path is required"
              );
            }
            return {
              content: [
                {
                  type: "text",
                  text: await this.projectAnalyzer.getFileContent(
                    args.filePath
                  ),
                },
              ],
            };

          case "analyze_recent_changes":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.gitAnalyzer.getRecentChanges(
                      args?.days || 7,
                      args?.maxCommits || 20
                    ),
                    null,
                    2
                  ),
                },
              ],
            };

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

          case "get_dependencies":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.projectAnalyzer.getDependencies(
                      args?.includeDevDeps !== false
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

    // Handle resource reads
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        switch (uri) {
          case "file://project-structure":
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    await this.projectAnalyzer.getProjectStructure(),
                    null,
                    2
                  ),
                },
              ],
            };

          case "file://recent-changes":
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    this.fileWatcher.getRecentChanges(),
                    null,
                    2
                  ),
                },
              ],
            };

          default:
            throw new McpError(
              ErrorCode.InvalidParams,
              `Resource ${uri} not found`
            );
        }
      }
    );
  }

  async start() {
    // Initialize database
    await this.database.initialize();

    // Start file watcher
    await this.fileWatcher.start();

    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error("Dev Assistant MCP Server started successfully");
  }

  async stop() {
    await this.fileWatcher.stop();
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
