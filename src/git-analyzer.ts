import simpleGit, { SimpleGit, LogOptions } from "simple-git";
import path from "path";

export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
  files: string[];
  insertions: number;
  deletions: number;
}

export interface GitAnalysis {
  commits: GitCommit[];
  summary: {
    totalCommits: number;
    activeFiles: string[];
    topAuthors: Array<{ name: string; commits: number }>;
    recentActivity: {
      lastCommit: string;
      commitsLastWeek: number;
      commitsLastMonth: number;
    };
  };
}

export class GitAnalyzer {
  private git: SimpleGit;

  constructor(private projectPath: string) {
    this.git = simpleGit(projectPath);
  }

  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.revparse(["--git-dir"]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getRecentChanges(
    days: number = 7,
    maxCommits: number = 20
  ): Promise<GitAnalysis> {
    if (!(await this.isGitRepository())) {
      return {
        commits: [],
        summary: {
          totalCommits: 0,
          activeFiles: [],
          topAuthors: [],
          recentActivity: {
            lastCommit: "",
            commitsLastWeek: 0,
            commitsLastMonth: 0,
          },
        },
      };
    }

    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const logOptions: LogOptions = {
        maxCount: maxCommits,
        since: since.toISOString(),
        format: {
          hash: "%H",
          date: "%ai",
          message: "%s",
          author_name: "%an",
          author_email: "%ae",
        },
      };

      const log = await this.git.log(logOptions);
      const commits: GitCommit[] = [];

      for (const commit of log.all) {
        try {
          // Get file changes for this commit
          const diffSummary = await this.git.diffSummary([
            `${commit.hash}^`,
            commit.hash,
          ]);

          commits.push({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            author: commit.author_name,
            files: diffSummary.files.map((f) => f.file),
            insertions: diffSummary.insertions,
            deletions: diffSummary.deletions,
          });
        } catch (error) {
          // If we can't get diff (e.g., initial commit), add with basic info
          commits.push({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            author: commit.author_name,
            files: [],
            insertions: 0,
            deletions: 0,
          });
        }
      }

      // Generate summary
      const allFiles = new Set<string>();
      const authorCounts = new Map<string, number>();

      commits.forEach((commit) => {
        commit.files.forEach((file) => allFiles.add(file));
        authorCounts.set(
          commit.author,
          (authorCounts.get(commit.author) || 0) + 1
        );
      });

      const topAuthors = Array.from(authorCounts.entries())
        .map(([name, commits]) => ({ name, commits }))
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 5);

      // Calculate activity metrics
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const commitsLastWeek = commits.filter(
        (c) => new Date(c.date) > oneWeekAgo
      ).length;
      const commitsLastMonth = commits.filter(
        (c) => new Date(c.date) > oneMonthAgo
      ).length;

      return {
        commits,
        summary: {
          totalCommits: commits.length,
          activeFiles: Array.from(allFiles),
          topAuthors,
          recentActivity: {
            lastCommit: commits[0]?.date || "",
            commitsLastWeek,
            commitsLastMonth,
          },
        },
      };
    } catch (error) {
      console.error("Error analyzing git history:", error);
      return {
        commits: [],
        summary: {
          totalCommits: 0,
          activeFiles: [],
          topAuthors: [],
          recentActivity: {
            lastCommit: "",
            commitsLastWeek: 0,
            commitsLastMonth: 0,
          },
        },
      };
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      if (!(await this.isGitRepository())) {
        return "not-a-git-repo";
      }
      const branch = await this.git.revparse(["--abbrev-ref", "HEAD"]);
      return branch.trim();
    } catch (error) {
      return "unknown";
    }
  }

  async getStatus(): Promise<{
    modified: string[];
    added: string[];
    deleted: string[];
    untracked: string[];
  }> {
    try {
      if (!(await this.isGitRepository())) {
        return { modified: [], added: [], deleted: [], untracked: [] };
      }

      const status = await this.git.status();

      return {
        modified: status.modified,
        added: status.staged,
        deleted: status.deleted,
        untracked: status.not_added,
      };
    } catch (error) {
      console.error("Error getting git status:", error);
      return { modified: [], added: [], deleted: [], untracked: [] };
    }
  }

  async getFileHistory(
    filePath: string,
    maxCommits: number = 10
  ): Promise<GitCommit[]> {
    try {
      if (!(await this.isGitRepository())) {
        return [];
      }

      const log = await this.git.log({
        file: filePath,
        maxCount: maxCommits,
        format: {
          hash: "%H",
          date: "%ai",
          message: "%s",
          author_name: "%an",
        },
      });

      const commits: GitCommit[] = [];

      for (const commit of log.all) {
        try {
          const diffSummary = await this.git.diffSummary([
            `${commit.hash}^`,
            commit.hash,
            "--",
            filePath,
          ]);

          commits.push({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            author: commit.author_name,
            files: [filePath],
            insertions: diffSummary.insertions,
            deletions: diffSummary.deletions,
          });
        } catch (error) {
          commits.push({
            hash: commit.hash,
            date: commit.date,
            message: commit.message,
            author: commit.author_name,
            files: [filePath],
            insertions: 0,
            deletions: 0,
          });
        }
      }

      return commits;
    } catch (error) {
      console.error("Error getting file history:", error);
      return [];
    }
  }
}
