// Tests for persistent research job storage (Round 11 wiring).
//
// Verifies that:
//   1. createJob persists to the DB
//   2. getJob retrieves from the DB after the in-memory Map is cleared
//   3. listJobs merges in-memory + DB jobs
//   4. deleteJob removes from both
//   5. persistJob updates the DB row

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock better-sqlite3 with an in-memory implementation.
// We mock the ../db module directly (research-store.ts imports getDb from it).
const dbStore = new Map<string, Record<string, unknown>>();

const mockDb = {
  prepare: (sql: string) => {
    const isInsert = /INSERT OR REPLACE/i.test(sql);
    const isSelectOne = /SELECT \* FROM research_jobs WHERE id = \?/i.test(sql);
    const isSelectAll = /SELECT \* FROM research_jobs ORDER BY/i.test(sql);
    const isDelete = /DELETE FROM research_jobs WHERE id = \?/i.test(sql);

    return {
      run: (params: Record<string, unknown> | unknown[]) => {
        if (isInsert) {
          dbStore.set(String((params as Record<string, unknown>).id), { ...(params as Record<string, unknown>) });
        } else if (isDelete) {
          // DELETE uses positional params: run(id) where id is a string.
          const id = typeof params === "string"
            ? params
            : Array.isArray(params)
              ? String(params[0])
              : String((params as Record<string, unknown>).id);
          dbStore.delete(id);
        }
        return { changes: 1 };
      },
      get: (id: string) => {
        if (isSelectOne) return dbStore.get(String(id));
        return undefined;
      },
      all: () => {
        if (isSelectAll) return Array.from(dbStore.values());
        return [];
      },
    };
  },
  pragma: () => {},
  exec: () => {},
};

// Mock the ../db module so getDb() returns our mock SQLite instance.
vi.mock("../db", () => ({
  getDb: () => mockDb,
  getPrismaDb: async () => null,
  isPostgresAvailable: () => false,
  activeDbType: "sqlite" as const,
}));

import { createJob, getJob, listJobs, deleteJob, persistJob } from "../research-store";

describe("Persistent research job storage (Round 11 wiring)", () => {
  beforeEach(() => {
    dbStore.clear();
    // Also clear the in-memory Map.
    const g = globalThis as typeof globalThis & { __deepResearchJobs?: Map<string, unknown> };
    if (g.__deepResearchJobs) g.__deepResearchJobs.clear();
    // Reset the dbAvailable flag so each test re-initializes.
    // We can't directly access it, but clearing the Map + DB is enough.
  });

  it("createJob persists to the DB", () => {
    const config = {
      query: "test query",
      depth: "standard" as const,
      numSubQueries: 5,
      maxLinksPerQuery: 5,
      pageReadConcurrency: 3,
      reportMaxTokens: 4000,
      retriever: "duckduckgo" as const,
      llmProvider: "nvidia" as const,
      enableMultiRound: true,
      numGapQueries: 3,
    };

    const job = createJob("test query", config);

    // DB should have the job.
    expect(dbStore.size).toBe(1);
    const row = dbStore.get(job.id);
    expect(row).toBeDefined();
    expect(row!.query).toBe("test query");
    expect(row!.status).toBe("queued");
  });

  it("getJob retrieves from DB after in-memory Map is cleared", () => {
    const config = {
      query: "persist test",
      depth: "standard" as const,
      numSubQueries: 5,
      maxLinksPerQuery: 5,
      pageReadConcurrency: 3,
      reportMaxTokens: 4000,
      retriever: "duckduckgo" as const,
      llmProvider: "nvidia" as const,
      enableMultiRound: true,
      numGapQueries: 3,
    };

    const job = createJob("persist test", config);
    const jobId = job.id;

    // Simulate server restart: clear the in-memory Map.
    const g = globalThis as typeof globalThis & { __deepResearchJobs?: Map<string, unknown> };
    if (g.__deepResearchJobs) g.__deepResearchJobs.clear();

    // getJob should now fall back to the DB.
    const recovered = getJob(jobId);
    expect(recovered).toBeDefined();
    expect(recovered!.id).toBe(jobId);
    expect(recovered!.query).toBe("persist test");
  });

  it("listJobs merges in-memory and DB jobs", () => {
    const config = {
      query: "list test",
      depth: "standard" as const,
      numSubQueries: 5,
      maxLinksPerQuery: 5,
      pageReadConcurrency: 3,
      reportMaxTokens: 4000,
      retriever: "duckduckgo" as const,
      llmProvider: "nvidia" as const,
      enableMultiRound: true,
      numGapQueries: 3,
    };

    // Create a job (goes to both Map and DB).
    const job1 = createJob("job 1", config);

    // Clear Map, create another job (goes to both).
    const g = globalThis as typeof globalThis & { __deepResearchJobs?: Map<string, unknown> };
    if (g.__deepResearchJobs) g.__deepResearchJobs.clear();
    const job2 = createJob("job 2", config);

    // Now Map has job2, DB has job1 + job2.
    const all = listJobs();
    const ids = all.map((j) => j.id);
    expect(ids).toContain(job1.id);
    expect(ids).toContain(job2.id);
  });

  it("deleteJob removes from both Map and DB", () => {
    const config = {
      query: "delete test",
      depth: "standard" as const,
      numSubQueries: 5,
      maxLinksPerQuery: 5,
      pageReadConcurrency: 3,
      reportMaxTokens: 4000,
      retriever: "duckduckgo" as const,
      llmProvider: "nvidia" as const,
      enableMultiRound: true,
      numGapQueries: 3,
    };

    const job = createJob("delete test", config);
    expect(dbStore.has(job.id)).toBe(true);

    deleteJob(job.id);

    expect(dbStore.has(job.id)).toBe(false);
    expect(getJob(job.id)).toBeUndefined();
  });

  it("persistJob updates the DB row with new status", () => {
    const config = {
      query: "update test",
      depth: "standard" as const,
      numSubQueries: 5,
      maxLinksPerQuery: 5,
      pageReadConcurrency: 3,
      reportMaxTokens: 4000,
      retriever: "duckduckgo" as const,
      llmProvider: "nvidia" as const,
      enableMultiRound: true,
      numGapQueries: 3,
    };

    const job = createJob("update test", config);
    expect(dbStore.get(job.id)!.status).toBe("queued");

    // Simulate status change.
    job.status = "completed";
    job.report = "# Final Report\n\nDone.";
    persistJob(job);

    const row = dbStore.get(job.id);
    expect(row!.status).toBe("completed");
    expect(row!.report).toBe("# Final Report\n\nDone.");
  });

  it("survives server restart: completed job persists", () => {
    const config = {
      query: "restart survival",
      depth: "standard" as const,
      numSubQueries: 5,
      maxLinksPerQuery: 5,
      pageReadConcurrency: 3,
      reportMaxTokens: 4000,
      retriever: "duckduckgo" as const,
      llmProvider: "nvidia" as const,
      enableMultiRound: true,
      numGapQueries: 3,
    };

    const job = createJob("restart survival", config);
    job.status = "completed";
    job.report = "# Survived Restart";
    persistJob(job);

    // Simulate server restart.
    const g = globalThis as typeof globalThis & { __deepResearchJobs?: Map<string, unknown> };
    if (g.__deepResearchJobs) g.__deepResearchJobs.clear();

    const recovered = getJob(job.id);
    expect(recovered).toBeDefined();
    expect(recovered!.status).toBe("completed");
    expect(recovered!.report).toBe("# Survived Restart");
  });
});
