import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs/promises";
import { existsSync, accessSync, constants } from "fs";
import { homedir } from "os";
import crypto from "crypto";

export interface StoredFact {
  id: number;
  category: string;
  fact: string;
  context?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleDeployment {
  id: number;
  templateVersion: string;
  deployedAt: string;
  deployedBy?: string;
  totalFiles: number;
  backupPath?: string;
}

export interface RuleFile {
  id: number;
  deploymentId: number;
  filename: string;
  contentHash: string;
  deployedAt: string;
}

export class ContextDatabase {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Use a safe directory for the database - either provided path or home directory
    if (dbPath) {
      this.dbPath = dbPath;
    } else {
      // Try to use the project directory, but fall back to home directory if not writable
      const projectDb = path.join(process.cwd(), ".dev-assistant.db");
      const homeDb = path.join(homedir(), ".dev-assistant.db");

      try {
        // Test if we can write to the project directory
        accessSync(process.cwd(), constants.W_OK);
        this.dbPath = projectDb;
      } catch (error) {
        // Fall back to home directory
        this.dbPath = homeDb;
        console.error(`Warning: Using database in home directory: ${homeDb}`);
      }
    }
  }

  async initialize(): Promise<void> {
    // Ensure the directory exists
    const dbDir = path.dirname(this.dbPath);
    await fs.mkdir(dbDir, { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const run = (sql: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        this.db!.run(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };

    // Create facts table
    await run(`
      CREATE TABLE IF NOT EXISTS facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        fact TEXT NOT NULL,
        context TEXT,
        tags TEXT, -- JSON array of tags
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create rule deployments table
    await run(`
      CREATE TABLE IF NOT EXISTS rule_deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_version TEXT NOT NULL,
        deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deployed_by TEXT,
        total_files INTEGER NOT NULL,
        backup_path TEXT
      )
    `);

    // Create rule files table
    await run(`
      CREATE TABLE IF NOT EXISTS rule_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Run migrations for existing databases
    await this.runMigrations();

    // Create indexes for better search performance
    await run(`
      CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_facts_created_at ON facts(created_at)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_rule_deployments_deployed_at ON rule_deployments(deployed_at)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_rule_files_deployment_id ON rule_files(deployment_id)
    `);
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const run = (sql: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        this.db!.run(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };

    const columnExists = (
      tableName: string,
      columnName: string
    ): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        this.db!.all(`PRAGMA table_info(${tableName})`, (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const exists = rows.some((row) => row.name === columnName);
            resolve(exists);
          }
        });
      });
    };

    try {
      // Migration 1: Update rule_deployments table schema
      const hasOldTemplateHash = await columnExists(
        "rule_deployments",
        "template_hash"
      );
      const hasTotalFiles = await columnExists(
        "rule_deployments",
        "total_files"
      );

      if (hasOldTemplateHash || !hasTotalFiles) {
        console.error("Migrating rule_deployments table to new schema...");

        // Create new table with correct schema
        await run(`
          CREATE TABLE rule_deployments_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_version TEXT NOT NULL,
            deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deployed_by TEXT,
            total_files INTEGER NOT NULL DEFAULT 1,
            backup_path TEXT
          )
        `);

        // Copy data from old table, setting default total_files to 1
        await run(`
          INSERT INTO rule_deployments_new (id, template_version, deployed_at, deployed_by, total_files, backup_path)
          SELECT id, template_version, deployed_at, deployed_by, 1, backup_path
          FROM rule_deployments
        `);

        // Drop old table and rename new one
        await run(`DROP TABLE rule_deployments`);
        await run(
          `ALTER TABLE rule_deployments_new RENAME TO rule_deployments`
        );

        console.error("Migration completed successfully.");
      }
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  async storeFact(
    category: string,
    fact: string,
    context?: string,
    tags: string[] = []
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO facts (category, fact, context, tags) 
         VALUES (?, ?, ?, ?)`,
        [category, fact, context, JSON.stringify(tags)],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getFacts(
    category?: string,
    tags?: string[],
    search?: string,
    limit: number = 20
  ): Promise<StoredFact[]> {
    if (!this.db) throw new Error("Database not initialized");

    let query = "SELECT * FROM facts WHERE 1=1";
    const params: any[] = [];

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    if (search) {
      query += " AND (fact LIKE ? OR context LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (tags && tags.length > 0) {
      // Search for any of the provided tags in the JSON array
      const tagConditions = tags.map(() => "tags LIKE ?").join(" OR ");
      query += ` AND (${tagConditions})`;
      tags.forEach((tag) => {
        params.push(`%"${tag}"%`);
      });
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      fact: row.fact,
      context: row.context,
      tags: JSON.parse(row.tags || "[]"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updateFact(
    id: number,
    updates: Partial<Pick<StoredFact, "category" | "fact" | "context" | "tags">>
  ): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const fields: string[] = [];
    const params: any[] = [];

    if (updates.category !== undefined) {
      fields.push("category = ?");
      params.push(updates.category);
    }

    if (updates.fact !== undefined) {
      fields.push("fact = ?");
      params.push(updates.fact);
    }

    if (updates.context !== undefined) {
      fields.push("context = ?");
      params.push(updates.context);
    }

    if (updates.tags !== undefined) {
      fields.push("tags = ?");
      params.push(JSON.stringify(updates.tags));
    }

    if (fields.length === 0) return;

    fields.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    await new Promise<void>((resolve, reject) => {
      this.db!.run(
        `UPDATE facts SET ${fields.join(", ")} WHERE id = ?`,
        params,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async deleteFact(id: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await new Promise<void>((resolve, reject) => {
      this.db!.run("DELETE FROM facts WHERE id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getCategories(): Promise<string[]> {
    if (!this.db) throw new Error("Database not initialized");

    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all(
        "SELECT DISTINCT category FROM facts ORDER BY category",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return rows.map((row) => row.category);
  }

  async getAllTags(): Promise<string[]> {
    if (!this.db) throw new Error("Database not initialized");

    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all(
        "SELECT DISTINCT tags FROM facts WHERE tags IS NOT NULL",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const allTags = new Set<string>();
    rows.forEach((row) => {
      try {
        const tags = JSON.parse(row.tags || "[]");
        tags.forEach((tag: string) => allTags.add(tag));
      } catch (e) {
        // Ignore invalid JSON
      }
    });

    return Array.from(allTags).sort();
  }

  // Rule deployment methods
  async storeRuleDeployment(
    templateVersion: string,
    totalFiles: number,
    deployedBy?: string,
    backupPath?: string
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO rule_deployments (template_version, total_files, deployed_by, backup_path) 
         VALUES (?, ?, ?, ?)`,
        [templateVersion, totalFiles, deployedBy, backupPath],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getLatestRuleDeployment(): Promise<RuleDeployment | null> {
    if (!this.db) throw new Error("Database not initialized");

    const row = await new Promise<any>((resolve, reject) => {
      this.db!.get(
        "SELECT * FROM rule_deployments ORDER BY deployed_at DESC LIMIT 1",
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!row) return null;

    return {
      id: row.id,
      templateVersion: row.template_version,
      deployedAt: row.deployed_at,
      deployedBy: row.deployed_by,
      totalFiles: row.total_files,
      backupPath: row.backup_path,
    };
  }

  async getRuleDeploymentHistory(
    limit: number = 10
  ): Promise<RuleDeployment[]> {
    if (!this.db) throw new Error("Database not initialized");

    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all(
        "SELECT * FROM rule_deployments ORDER BY deployed_at DESC LIMIT ?",
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return rows.map((row) => ({
      id: row.id,
      templateVersion: row.template_version,
      deployedAt: row.deployed_at,
      deployedBy: row.deployed_by,
      totalFiles: row.total_files,
      backupPath: row.backup_path,
    }));
  }

  async storeRuleFile(
    deploymentId: number,
    filename: string,
    contentHash: string
  ): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO rule_files (deployment_id, filename, content_hash) 
         VALUES (?, ?, ?)`,
        [deploymentId, filename, contentHash],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getRuleFiles(deploymentId: number): Promise<RuleFile[]> {
    if (!this.db) throw new Error("Database not initialized");

    const rows = await new Promise<any[]>((resolve, reject) => {
      this.db!.all(
        "SELECT * FROM rule_files WHERE deployment_id = ? ORDER BY filename",
        [deploymentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return rows.map((row) => ({
      id: row.id,
      deploymentId: row.deployment_id,
      filename: row.filename,
      contentHash: row.content_hash,
      deployedAt: row.deployed_at,
    }));
  }

  async getLatestRuleFiles(): Promise<RuleFile[]> {
    if (!this.db) throw new Error("Database not initialized");

    const latestDeployment = await this.getLatestRuleDeployment();
    if (!latestDeployment) return [];

    return this.getRuleFiles(latestDeployment.id);
  }

  generateHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }
}
