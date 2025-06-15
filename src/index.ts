#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

import { ContextDatabase } from "./database.js";
import {
  CURSOR_RULES_TEMPLATES,
  TEMPLATE_VERSION,
  TEMPLATE_METADATA,
} from "./rules-template.js";

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
          {
            name: "setup_project_rules",
            description:
              "Initialize or update Cursor project rules with company standards",
            inputSchema: {
              type: "object",
              properties: {
                force_update: {
                  type: "boolean",
                  description:
                    "Force update even if rules have been manually modified (default: false)",
                  default: false,
                },
                backup_existing: {
                  type: "boolean",
                  description:
                    "Create backup of existing rules before overwriting (default: true)",
                  default: true,
                },
                deployed_by: {
                  type: "string",
                  description:
                    "Name or identifier of who is deploying the rules",
                },
                workspace_path: {
                  type: "string",
                  description:
                    "Path to the workspace directory where .cursor/rules should be created (defaults to current working directory)",
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

          case "setup_project_rules":
            return await this.setupProjectRules(
              args?.force_update || false,
              args?.backup_existing !== false,
              args?.deployed_by,
              args?.workspace_path
            );

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

  private async setupProjectRules(
    forceUpdate: boolean = false,
    backupExisting: boolean = true,
    deployedBy?: string,
    workspacePath?: string
  ) {
    try {
      // Path validation: use as-is if ends with .cursor/rules, else append
      let rulesDir: string;
      if (workspacePath) {
        if (workspacePath.endsWith(path.join(".cursor", "rules"))) {
          rulesDir = workspacePath;
        } else {
          rulesDir = path.join(workspacePath, ".cursor", "rules");
        }
      } else {
        rulesDir = path.join(process.cwd(), ".cursor", "rules");
      }
      const baseDir = path.dirname(rulesDir);
      console.error("setupProjectRules: resolved rulesDir:", rulesDir);

      // Check if rulesDir is writable or can be created
      try {
        await fs.mkdir(rulesDir, { recursive: true });
        // Try to write a temp file to check permissions
        const testFile = path.join(rulesDir, ".write_test");
        await fs.writeFile(testFile, "test");
        await fs.unlink(testFile);
      } catch (err) {
        throw new Error(
          `Cannot write to rules directory: ${rulesDir}. Error: ${err}`
        );
      }

      const now = new Date();
      const timestamp = now.toISOString();

      // Check if rules directory exists and get current files
      let existingFiles: string[] = [];
      let existingHashes: Map<string, string> = new Map();

      try {
        const files = await fs.readdir(rulesDir);
        existingFiles = files.filter((f) => f.endsWith(".mdc"));

        // Read existing files and compute hashes
        for (const filename of existingFiles) {
          try {
            const content = await fs.readFile(
              path.join(rulesDir, filename),
              "utf-8"
            );
            existingHashes.set(filename, this.database.generateHash(content));
          } catch (error) {
            // File might not be readable, skip it
          }
        }
      } catch (error) {
        // Directory doesn't exist, which is fine for first setup
      }

      // Get the latest deployment info
      const latestDeployment = await this.database.getLatestRuleDeployment();
      const latestRuleFiles = await this.database.getLatestRuleFiles();

      // Generate new rule contents with metadata
      const newRules = CURSOR_RULES_TEMPLATES.map((template) => ({
        ...template,
        content: template.content.replace(/\{timestamp\}/g, timestamp),
      }));

      // Compute hashes for new rules
      const newHashes = new Map(
        newRules.map((rule) => [
          rule.filename,
          this.database.generateHash(rule.content),
        ])
      );

      // Check if update is needed
      if (existingFiles.length > 0 && !forceUpdate) {
        // Check if any files have changed since last deployment
        const hasChanges = latestRuleFiles.some((ruleFile) => {
          const currentHash = existingHashes.get(ruleFile.filename);
          return currentHash && currentHash !== ruleFile.contentHash;
        });

        const hasNewTemplate = newRules.some((rule) => {
          const existingHash = existingHashes.get(rule.filename);
          const newHash = newHashes.get(rule.filename);
          return !existingHash || existingHash !== newHash;
        });

        if (!hasChanges && !hasNewTemplate) {
          return {
            content: [
              {
                type: "text",
                text: "Project rules are already up to date. Use force_update=true to overwrite.",
              },
            ],
          };
        }

        // Rules have been modified since last deployment
        if (hasChanges) {
          const modificationWarning = `
WARNING: Some .cursor/rules files have been manually modified since the last deployment.
- Last deployed: ${latestDeployment?.deployedAt || "Unknown"}
- Last deployed by: ${latestDeployment?.deployedBy || "Unknown"}
- Use force_update=true to overwrite the modifications.

Modified files detected:
${latestRuleFiles
  .filter((rf) => {
    const currentHash = existingHashes.get(rf.filename);
    return currentHash && currentHash !== rf.contentHash;
  })
  .map((rf) => `  - ${rf.filename}`)
  .join("\n")}
          `;

          return {
            content: [
              {
                type: "text",
                text: modificationWarning.trim(),
              },
            ],
          };
        }
      }

      // Create .cursor/rules directory if it doesn't exist
      await fs.mkdir(rulesDir, { recursive: true });

      let backupPath: string | undefined;

      // Create backup if requested and files exist
      if (backupExisting && existingFiles.length > 0) {
        const backupDir = path.join(rulesDir, "backups");
        const backupTimestamp = now.toISOString().replace(/[:.]/g, "-");
        backupPath = path.join(backupDir, `backup-${backupTimestamp}`);
        await fs.mkdir(backupPath, { recursive: true });

        // Backup existing files
        for (const filename of existingFiles) {
          const sourcePath = path.join(rulesDir, filename);
          const backupFilePath = path.join(backupPath, filename);
          await fs.copyFile(sourcePath, backupFilePath);
        }
      }

      // Store deployment record
      const deploymentId = await this.database.storeRuleDeployment(
        TEMPLATE_VERSION,
        newRules.length,
        deployedBy,
        backupPath
      );

      // Write the new rule files
      const deployedFiles: string[] = [];
      for (const rule of newRules) {
        const filePath = path.join(rulesDir, rule.filename);
        try {
          await fs.writeFile(filePath, rule.content, "utf-8");
        } catch (err) {
          throw new Error(
            `Failed to write rule file: ${filePath}. Error: ${err}`
          );
        }
        // Store individual file record
        await this.database.storeRuleFile(
          deploymentId,
          rule.filename,
          newHashes.get(rule.filename)!
        );
        deployedFiles.push(rule.filename);
      }

      // Verify all files exist after writing
      for (const filename of deployedFiles) {
        const filePath = path.join(rulesDir, filename);
        try {
          await fs.access(filePath);
        } catch (err) {
          throw new Error(`Rule file missing after write: ${filePath}`);
        }
      }

      // Store a fact about this deployment
      await this.database.storeFact(
        "project-setup",
        `Cursor project rules deployed (v${TEMPLATE_VERSION}) - ${newRules.length} files`,
        `Deployed by: ${deployedBy || "Unknown"}, Files: ${deployedFiles.join(
          ", "
        )}`,
        ["cursor-rules", "deployment", "project-setup", "mdc-format"]
      );

      const successMessage = `
✅ Cursor project rules successfully ${
        existingFiles.length > 0 ? "updated" : "created"
      }!

📋 Deployment Details:
- Template version: ${TEMPLATE_VERSION}
- Deployed at: ${timestamp}
- Deployed by: ${deployedBy || "Unknown"}
- Files deployed: ${newRules.length}
- Deployment ID: ${deploymentId}
${backupPath ? `- Backup created: ${path.relative(baseDir, backupPath)}` : ""}

📍 Rules location: .cursor/rules/

📄 Deployed Files:
${deployedFiles.map((f) => `  - ${f}`).join("\n")}

The rules are now organized by category with proper .mdc metadata:
- Targeted application based on file patterns
- Configurable activation modes (always, auto-attach, etc.)
- Modern Cursor rules format with full metadata support

These rules will help maintain consistency across your development team with:
- Code style and formatting standards
- Architecture and design patterns  
- Testing requirements and best practices
- Security guidelines and data protection
- Performance optimization techniques
- Documentation standards
- Git workflow and version control
- Accessibility compliance (WCAG 2.1)
      `;

      return {
        content: [
          {
            type: "text",
            text: successMessage.trim(),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to setup project rules: ${error}`
      );
    }
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
