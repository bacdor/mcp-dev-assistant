# Dev Assistant MCP Server

A Model Context Protocol (MCP) server that helps development teams maintain consistent codebases through fact storage and automated project rule management.

## Features

### 📝 Fact Management

- **Store facts**: Remember important project insights, architectural decisions, and patterns
- **Recall facts**: Search and filter stored knowledge by category, tags, or content
- **Organize knowledge**: Categorize facts with tags for easy retrieval

### 🎯 Project Rules Management

- **Automated setup**: Initialize Cursor project rules with comprehensive development standards
- **Smart updates**: Detect manual modifications and prevent accidental overwrites
- **Version tracking**: Track rule deployments with hash-based change detection
- **Backup system**: Automatically backup existing rules before updates

## Tools

### `remember_fact`

Store a useful fact or insight about the project.

**Parameters:**

- `category` (required): Category of the fact (e.g., "architecture", "patterns", "decisions")
- `fact` (required): The fact or insight to remember
- `context` (optional): Additional context about when/where this applies
- `tags` (optional): Array of tags to help categorize and find this fact later

**Example:**

```json
{
  "category": "architecture",
  "fact": "We use Redux for global state management in the main app",
  "context": "Decided during sprint planning for better predictability",
  "tags": ["redux", "state-management", "frontend"]
}
```

### `recall_facts`

Retrieve stored facts and insights.

**Parameters:**

- `category` (optional): Filter by category
- `tags` (optional): Filter by tags (array)
- `search` (optional): Search in fact content
- `limit` (optional): Maximum number of facts to return (default: 20)

**Example:**

```json
{
  "category": "architecture",
  "tags": ["frontend"],
  "search": "state",
  "limit": 10
}
```

### `setup_project_rules`

Initialize or update Cursor project rules with company standards.

**Parameters:**

- `force_update` (optional): Force update even if rules have been manually modified (default: false)
- `backup_existing` (optional): Create backup of existing rules before overwriting (default: true)
- `deployed_by` (optional): Name or identifier of who is deploying the rules

**Example:**

```json
{
  "force_update": false,
  "backup_existing": true,
  "deployed_by": "john.doe@company.com"
}
```

## Rule Template Features

The generated `.cursor/rules/` directory includes multiple .mdc files with comprehensive standards for:

### 🎨 Code Style & Formatting

- Consistent indentation and line length
- TypeScript/JavaScript best practices
- React-specific guidelines
- Import organization

### 🏗️ Architecture & Patterns

- File organization strategies
- State management patterns
- Error handling approaches
- Component design principles

### 🧪 Testing Standards

- Unit testing requirements
- Integration testing approaches
- Test organization and naming
- Coverage expectations

### 🔒 Security Guidelines

- Input validation requirements
- API security standards
- Authentication patterns
- Data protection practices

### ⚡ Performance Standards

- Frontend optimization techniques
- Backend performance requirements
- Caching strategies
- Monitoring approaches

### 📚 Documentation Requirements

- Code documentation standards
- API documentation expectations
- README maintenance
- Comment guidelines

### 🔄 Git & Version Control

- Commit message standards
- Branch strategy
- Code review requirements
- Merge practices

### ♿ Accessibility Standards

- Web accessibility requirements
- WCAG compliance guidelines
- Testing approaches
- Implementation standards

### 📊 Monitoring & Logging

- Application monitoring setup
- Error tracking requirements
- Logging standards
- Alert configuration

## Smart Update System

The rule management system provides intelligent update handling:

### Change Detection

- **Hash-based tracking**: Each rule deployment is tracked with a SHA-256 hash
- **Modification detection**: Compares current rules with last deployed version
- **Version tracking**: Maintains deployment history with timestamps and deployers

### Update Behaviors

- **First setup**: Creates `.cursor/rules/` directory with multiple .mdc files
- **No changes**: Skips update if rules are already current
- **Manual modifications**: Warns about changes and requires `force_update=true`
- **Force updates**: Overwrites existing rules (with backup if enabled)

### Modern .mdc Format

- **Structured metadata**: Each rule file includes frontmatter with name, description, and configuration
- **Targeted application**: File patterns ensure rules apply only to relevant file types
- **Flexible activation**: Rules can be set to always apply, auto-attach, agent-requested, or manual
- **Categorized organization**: Rules are split into logical categories for better maintainability

### Backup System

- **Automatic backups**: Creates timestamped backups before overwrites
- **Configurable**: Can be disabled with `backup_existing=false`
- **Storage location**: Backups stored in `.cursor/rules/backups/` directory

## Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Configuration

The server automatically manages its SQLite database:

- **Project directory**: Stores `.dev-assistant.db` in project root (if writable)
- **Home directory**: Falls back to home directory if project is read-only
- **Automatic setup**: Creates tables and indexes on first run

## Database Schema

### Facts Table

```sql
CREATE TABLE facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  fact TEXT NOT NULL,
  context TEXT,
  tags TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Rule Deployments Table

```sql
CREATE TABLE rule_deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_version TEXT NOT NULL,
  deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deployed_by TEXT,
  total_files INTEGER NOT NULL,
  backup_path TEXT
);
```

### Rule Files Table

```sql
CREATE TABLE rule_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deployment_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Use Cases

### Team Onboarding

- New team members can quickly set up consistent development environment
- Company standards automatically applied to all projects
- Knowledge base accessible through fact system

### Consistency Maintenance

- Periodic rule updates across all team projects
- Change tracking prevents accidental rule modifications
- Backup system ensures safe updates

### Knowledge Management

- Store architectural decisions and their context
- Track patterns and best practices
- Share insights across team members

## Integration

This MCP server integrates with:

- **Cursor IDE**: Project rules automatically configure development environment
- **Claude/AI assistants**: Facts provide context for better code assistance
- **CI/CD pipelines**: Can be integrated for automated rule deployment

## Development

### Building

```bash
npm run build
```

### Running in development

```bash
npm run dev
```

### Testing

The server uses stdio transport for MCP communication. Test with:

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/index.js
```

## License

MIT License - see LICENSE file for details.

---

_Built with the Model Context Protocol for seamless AI integration._
