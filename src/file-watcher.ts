import chokidar from "chokidar";
import path from "path";
import fs from "fs/promises";
import ignore from "ignore";
import { ContextDatabase } from "./database.js";

interface FileChange {
  path: string;
  type: "added" | "changed" | "removed";
  timestamp: string;
  size?: number;
}

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private ignoreFilter: ReturnType<typeof ignore>;
  private recentChanges: FileChange[] = [];
  private maxRecentChanges = 100;

  constructor(private projectPath: string, private database: ContextDatabase) {
    this.ignoreFilter = ignore();
    this.loadIgnorePatterns();
  }

  private async loadIgnorePatterns(): Promise<void> {
    // Load .gitignore patterns
    try {
      const gitignorePath = path.join(this.projectPath, ".gitignore");
      const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
      this.ignoreFilter.add(gitignoreContent);
    } catch (error) {
      // .gitignore doesn't exist, that's fine
    }

    // Add common patterns to ignore
    this.ignoreFilter.add([
      "node_modules/**",
      ".git/**",
      "build/**",
      "dist/**",
      "*.log",
      ".DS_Store",
      "Thumbs.db",
      "*.tmp",
      "*.temp",
      ".dev-assistant.db",
      ".next/**",
      ".nuxt/**",
      ".vscode/**",
      ".idea/**",
      "coverage/**",
      "*.min.js",
      "*.min.css",
    ]);
  }

  private shouldIgnoreFile(filePath: string): boolean {
    const relativePath = path.relative(this.projectPath, filePath);
    return this.ignoreFilter.ignores(relativePath);
  }

  private addChange(filePath: string, type: FileChange["type"]): void {
    if (this.shouldIgnoreFile(filePath)) {
      return;
    }

    const change: FileChange = {
      path: path.relative(this.projectPath, filePath),
      type,
      timestamp: new Date().toISOString(),
    };

    // Add file size for added/changed files
    if (type !== "removed") {
      fs.stat(filePath)
        .then((stats) => {
          change.size = stats.size;
        })
        .catch(() => {
          // File might have been deleted between the event and this check
        });
    }

    this.recentChanges.unshift(change);

    // Keep only the most recent changes
    if (this.recentChanges.length > this.maxRecentChanges) {
      this.recentChanges = this.recentChanges.slice(0, this.maxRecentChanges);
    }

    // Store significant changes in the database for learning
    this.analyzeAndStoreChange(change);
  }

  private async analyzeAndStoreChange(change: FileChange): Promise<void> {
    try {
      // Only analyze certain file types for learning
      const ext = path.extname(change.path).toLowerCase();
      const significantExtensions = [
        ".ts",
        ".js",
        ".tsx",
        ".jsx",
        ".vue",
        ".svelte",
        ".py",
        ".java",
        ".cpp",
        ".c",
        ".cs",
        ".go",
        ".rs",
        ".md",
        ".json",
        ".yaml",
        ".yml",
        ".toml",
        ".sql",
        ".graphql",
        ".proto",
      ];

      if (!significantExtensions.includes(ext)) {
        return;
      }

      // Determine if this is a significant change worth remembering
      const isNewFile = change.type === "added";
      const isConfigFile =
        /\.(config|rc)\.|package\.json|tsconfig|webpack|babel|eslint|prettier/.test(
          change.path
        );
      const isSourceFile =
        /\.(ts|js|tsx|jsx|vue|svelte|py|java|cpp|c|cs|go|rs)$/.test(
          change.path
        );

      if (isNewFile || isConfigFile) {
        let category = "file-changes";
        let fact = "";

        if (isNewFile) {
          category = "new-files";
          fact = `New ${ext} file created: ${change.path}`;
        } else if (isConfigFile) {
          category = "config-changes";
          fact = `Configuration file modified: ${change.path}`;
        }

        if (fact) {
          await this.database.storeFact(
            category,
            fact,
            `Detected at ${change.timestamp}`,
            ["auto-detected", "file-system", ext.substring(1)]
          );
        }
      }

      // For source files, we could potentially analyze the actual changes
      // This would require reading the file and doing diff analysis
      // For now, we just track that they changed
      if (isSourceFile && change.type === "changed") {
        // Could be extended to analyze actual code changes
        // For example, detecting new functions, classes, imports, etc.
      }
    } catch (error) {
      console.error("Error analyzing file change:", error);
    }
  }

  async start(): Promise<void> {
    if (this.watcher) {
      await this.stop();
    }

    this.watcher = chokidar.watch(this.projectPath, {
      ignored: [
        "**/.git/**",
        "**/node_modules/**",
        "**/build/**",
        "**/dist/**",
        "**/*.log",
        "**/.DS_Store",
        "**/Thumbs.db",
        "**/*.tmp",
        "**/*.temp",
        "**/.dev-assistant.db",
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher
      .on("add", (filePath) => this.addChange(filePath, "added"))
      .on("change", (filePath) => this.addChange(filePath, "changed"))
      .on("unlink", (filePath) => this.addChange(filePath, "removed"))
      .on("error", (error) => console.error("File watcher error:", error));

    console.error(`File watcher started for: ${this.projectPath}`);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  getRecentChanges(limit?: number): FileChange[] {
    return this.recentChanges.slice(0, limit || this.maxRecentChanges);
  }

  getChangesSince(timestamp: string): FileChange[] {
    const since = new Date(timestamp);
    return this.recentChanges.filter(
      (change) => new Date(change.timestamp) > since
    );
  }

  getChangesForFile(filePath: string): FileChange[] {
    return this.recentChanges.filter((change) => change.path === filePath);
  }

  clearRecentChanges(): void {
    this.recentChanges = [];
  }
}
