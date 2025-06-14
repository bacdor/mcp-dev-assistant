import sqlite3 from "sqlite3";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

export interface StoredFact {
  id: number;
  category: string;
  fact: string;
  context?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export class ContextDatabase {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), ".dev-assistant.db");
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

    const run = promisify(this.db.run.bind(this.db));

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

    // Create index for better search performance
    await run(`
      CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category)
    `);

    await run(`
      CREATE INDEX IF NOT EXISTS idx_facts_created_at ON facts(created_at)
    `);
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

    const all = promisify(this.db.all.bind(this.db));
    const rows = (await all(
      "SELECT DISTINCT category FROM facts ORDER BY category"
    )) as any[];

    return rows.map((row) => row.category);
  }

  async getAllTags(): Promise<string[]> {
    if (!this.db) throw new Error("Database not initialized");

    const all = promisify(this.db.all.bind(this.db));
    const rows = (await all(
      "SELECT DISTINCT tags FROM facts WHERE tags IS NOT NULL"
    )) as any[];

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
