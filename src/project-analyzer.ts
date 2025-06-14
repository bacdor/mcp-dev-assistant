import fs from "fs/promises";
import path from "path";
import { glob } from "glob";

export interface ProjectStructure {
  name: string;
  type: "file" | "directory";
  path: string;
  size?: number;
  children?: ProjectStructure[];
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  match: string;
}

export interface DependencyInfo {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  imports: {
    file: string;
    imports: string[];
  }[];
}

export class ProjectAnalyzer {
  constructor(private projectPath: string) {}

  async getProjectStructure(
    maxDepth: number = 3,
    includeHidden: boolean = false
  ): Promise<ProjectStructure> {
    const structure = await this.buildStructure(
      this.projectPath,
      "",
      0,
      maxDepth,
      includeHidden
    );
    return (
      structure || {
        name: path.basename(this.projectPath),
        type: "directory",
        path: "",
        children: [],
      }
    );
  }

  private async buildStructure(
    fullPath: string,
    relativePath: string,
    currentDepth: number,
    maxDepth: number,
    includeHidden: boolean
  ): Promise<ProjectStructure | null> {
    try {
      const stats = await fs.stat(fullPath);
      const name = path.basename(fullPath);

      if (!includeHidden && name.startsWith(".")) {
        return null;
      }

      const structure: ProjectStructure = {
        name,
        type: stats.isDirectory() ? "directory" : "file",
        path: relativePath,
      };

      if (stats.isFile()) {
        structure.size = stats.size;
      } else if (stats.isDirectory() && currentDepth < maxDepth) {
        const entries = await fs.readdir(fullPath);
        const children: ProjectStructure[] = [];

        for (const entry of entries) {
          const childPath = path.join(fullPath, entry);
          const childRelativePath = path.join(relativePath, entry);
          const child = await this.buildStructure(
            childPath,
            childRelativePath,
            currentDepth + 1,
            maxDepth,
            includeHidden
          );
          if (child) {
            children.push(child);
          }
        }

        structure.children = children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      }

      return structure;
    } catch (error) {
      return null;
    }
  }

  async searchCode(
    query: string,
    fileExtensions?: string[],
    caseSensitive: boolean = false
  ): Promise<SearchResult[]> {
    try {
      const pattern = fileExtensions?.length
        ? `**/*{${fileExtensions.join(",")}}`
        : "**/*";

      const files = await glob(pattern, {
        cwd: this.projectPath,
        ignore: [
          "node_modules/**",
          ".git/**",
          "build/**",
          "dist/**",
          "*.min.js",
          "*.min.css",
        ],
      });

      const results: SearchResult[] = [];
      const regex = new RegExp(query, caseSensitive ? "g" : "gi");

      for (const file of files) {
        try {
          const fullPath = path.join(this.projectPath, file);
          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split("\n");

          lines.forEach((line, index) => {
            const matches = line.match(regex);
            if (matches) {
              matches.forEach((match) => {
                results.push({
                  file,
                  line: index + 1,
                  content: line.trim(),
                  match,
                });
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read
        }
      }

      return results.slice(0, 100); // Limit results
    } catch (error) {
      console.error("Error searching code:", error);
      return [];
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      return content;
    } catch (error) {
      throw new Error(`Could not read file: ${filePath}`);
    }
  }

  async getDependencies(
    includeDevDeps: boolean = true
  ): Promise<DependencyInfo> {
    const result: DependencyInfo = {
      dependencies: {},
      devDependencies: {},
      imports: [],
    };

    try {
      // Read package.json
      const packageJsonPath = path.join(this.projectPath, "package.json");
      const packageContent = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageContent);

      result.dependencies = packageJson.dependencies || {};
      if (includeDevDeps) {
        result.devDependencies = packageJson.devDependencies || {};
      }

      // Analyze imports in TypeScript/JavaScript files
      const codeFiles = await glob("**/*.{ts,js,tsx,jsx}", {
        cwd: this.projectPath,
        ignore: ["node_modules/**", "build/**", "dist/**"],
      });

      for (const file of codeFiles.slice(0, 50)) {
        // Limit to avoid performance issues
        try {
          const content = await fs.readFile(
            path.join(this.projectPath, file),
            "utf-8"
          );
          const imports = this.extractImports(content);
          if (imports.length > 0) {
            result.imports.push({ file, imports });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      console.error("Error analyzing dependencies:", error);
    }

    return result;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegexes = [
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    importRegexes.forEach((regex) => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        imports.push(match[1]);
      }
    });

    return [...new Set(imports)]; // Remove duplicates
  }
}
