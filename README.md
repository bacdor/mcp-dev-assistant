# Dev Assistant MCP Server

A Model Context Protocol (MCP) server that watches your development work, remembers useful facts, and helps GPT stay consistent, project-aware, and contextually smart.

## Features

- **File Watching**: Monitors your project for changes and automatically learns from them
- **Context Memory**: Stores and retrieves project-specific facts, patterns, and insights
- **Git Integration**: Analyzes git history, recent changes, and project evolution
- **Code Analysis**: Searches code, analyzes dependencies, and understands project structure
- **Smart Filtering**: Automatically ignores common build artifacts and dependencies

## Installation

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Running the Server

```bash
# Development mode (with auto-rebuild)
npm run dev

# Production mode
npm run start
```

### Configuring with MCP Clients

Add this server to your MCP client configuration. For example, with Claude Desktop:

```json
{
  "mcpServers": {
    "dev-assistant": {
      "command": "node",
      "args": ["/path/to/your/mcp-server/build/index.js"],
      "env": {
        "PROJECT_PATH": "/path/to/your/project"
      }
    }
  }
}
```

### Environment Variables

- `PROJECT_PATH`: Path to the project you want to analyze (defaults to current directory)

## Available Tools

### Project Analysis

- **`get_project_structure`**: Get file and folder structure
- **`search_code`**: Search for patterns across the codebase
- **`get_file_content`**: Read specific files
- **`get_dependencies`**: Analyze package.json and imports

### Git Integration

- **`analyze_recent_changes`**: Get recent commits and changes
- Current branch and status information

### Context Memory

- **`remember_fact`**: Store project insights and facts
- **`recall_facts`**: Retrieve stored knowledge with filtering

## Available Resources

- **`file://project-structure`**: Current project structure
- **`file://recent-changes`**: Recent file modifications

## Database

The server uses SQLite to store learned facts and insights. The database file (`.dev-assistant.db`) is created in your project directory.

### Fact Categories

Facts are automatically categorized as:

- `architecture`: System design decisions
- `patterns`: Code patterns and conventions
- `decisions`: Development decisions and rationale
- `new-files`: Newly created files
- `config-changes`: Configuration modifications
- `file-changes`: General file modifications

## File Watching

The server automatically watches for changes and learns from:

- New file creation
- Configuration file changes
- Source code modifications
- Git operations

Files are intelligently filtered to ignore:

- `node_modules/`
- Build artifacts (`build/`, `dist/`)
- Log files
- Temporary files
- Binary files

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

This will start TypeScript in watch mode and rebuild automatically when files change.

### Project Structure

```
src/
├── index.ts          # Main server entry point
├── database.ts       # SQLite database operations
├── file-watcher.ts   # File system monitoring
├── git-analyzer.ts   # Git history analysis
└── project-analyzer.ts # Code analysis and project structure
```

## Examples

### Basic Usage

1. Start the server in your project directory
2. The server will begin watching for file changes
3. Use MCP client tools to interact with your project:

```typescript
// Get project structure
await callTool("get_project_structure", {
  maxDepth: 2,
  includeHidden: false,
});

// Search for patterns
await callTool("search_code", {
  query: "function.*async",
  fileExtensions: [".ts", ".js"],
});

// Remember a fact
await callTool("remember_fact", {
  category: "architecture",
  fact: "We use Repository pattern for data access",
  context: "Decided in team meeting on 2024-01-15",
  tags: ["pattern", "data-access"],
});

// Recall facts
await callTool("recall_facts", {
  category: "architecture",
  tags: ["pattern"],
});
```

### Advanced Configuration

You can extend the server by:

- Adding custom file watchers
- Implementing additional analysis tools
- Extending the database schema
- Adding more sophisticated code analysis

## License

MIT License - feel free to modify and use in your projects.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Troubleshooting

### Common Issues

**Server won't start**: Ensure all dependencies are installed and the project is built
**Database errors**: Check that the project directory is writable
**Git analysis fails**: Ensure the project is a git repository
**File watching not working**: Check that the project path is correct and readable

### Debug Mode

Set `DEBUG=1` environment variable for verbose logging:

```bash
DEBUG=1 npm run start
```
