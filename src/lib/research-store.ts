// Research job store — dual-mode: in-memory (active jobs) + persistent DB.
//
// Active jobs (queued/planning/.../synthesizing) live in the in-memory Map
// because they have runtime state (logs, thoughts, reportStream) that's only
// useful during execution and would be too heavy to write to the DB on every
// token.
//
// When a job reaches a milestone (status change, report complete), we persist
// its essential fields to the `research_jobs` table (SQLite or Postgres). This
// means:
//   - Server restart → completed/failed jobs survive (GET /api/research/status/[id] still works)
//   - In-memory Map is still the source of truth for active jobs
//
// The DB stores: id, query, status, plan, report, sources, stats, createdAt, updatedAt.
// Runtime fields (logs, thoughts, reportStream, etc.) are NOT persisted — they're
// only relevant during execution.

import { randomUUID } from "crypto";
import type { ResearchJob, ResearchConfig, ResearchStatus } from "./types";
import { getDb as getSqliteDb } from "./db";

const MAX_JOBS = 30;
const JOB_TTL_MS = 1000 * 60 * 60;

const ACTIVE_STATUSES: ReadonlySet<ResearchStatus> = new Set([
  "queued",
  "planning",
  "decomposing",
  "searching",
  "reading",
  "extracting",
  "analyzing_gaps",
  "synthesizing",
]);

type JobMap = Map<string, ResearchJob>;

function getStore(): JobMap {
  const g = globalThis as typeof globalThis & {
    __deepResearchJobs?: JobMap;
  };
  if (!g.__deepResearchJobs) {
    g.__deepResearchJobs = new Map<string, ResearchJob>();
  }
  return g.__deepResearchJobs;
}

// ---------- DB persistence ----------
// We use the SQLite client (always available). Postgres path is handled
// by db.ts if DATABASE_URL is postgresql://. For the research store, we
// only use SQLite because it's always available and the data volume is small.

let dbAvailable: boolean | null = null;

function getDb() {
  if (dbAvailable === false) return null;
  try {
    const db = getSqliteDb();
    if (dbAvailable === null) dbAvailable = true;
    return db;
  } catch {
    dbAvailable = false;
    return null;
  }
}

/**
 * Persist a job's essential fields to the `research_jobs` table.
 * Fire-and-forget: failures are logged but don't break the research flow.
 * Called by setStatus() in research-engine.ts on every status change.
 */
export function persistJob(job: ResearchJob): void {
  if (dbAvailable === false) return;
  const db = getDb();
  if (!db) return;

  try {
    db.prepare(
      `INSERT OR REPLACE INTO research_jobs
        (id, user_id, query, plan, report, sources, stats, verification_report, status, created_at, updated_at)
       VALUES (@id, @userId, @query, @plan, @report, @sources, @stats, @verificationReport, @status, @createdAt, @updatedAt)`
    ).run({
      id: job.id,
      userId: "default",
      query: job.query,
      plan: job.plan ? JSON.stringify(job.plan) : null,
      report: job.report || null,
      sources: job.sources.length > 0 ? JSON.stringify(job.sources.slice(0, 50)) : null,
      stats: JSON.stringify(job.stats),
      verificationReport: null,
      status: job.status,
      createdAt: new Date(job.createdAt).toISOString(),
      updatedAt: new Date(job.updatedAt).toISOString(),
    });
  } catch (err) {
    // DB write failed — don't break the research. Just log.
    console.warn("[research-store] persistJob failed:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Reconstruct a ResearchJob from a DB row.
 * Runtime fields (logs, thoughts, etc.) are empty — they were not persisted.
 */
function recordToJob(row: Record<string, unknown>): ResearchJob {
  const now = Date.now();
  let plan: ResearchJob["plan"] = null;
  try {
    if (row.plan) plan = JSON.parse(String(row.plan));
  } catch { /* ignore */ }

  let sources: ResearchJob["sources"] = [];
  try {
    if (row.sources) sources = JSON.parse(String(row.sources));
  } catch { /* ignore */ }

  let stats: ResearchJob["stats"] = {
    totalPagesFound: 0,
    totalPagesRead: 0,
    totalPagesSucceeded: 0,
    totalTokensUsed: 0,
    elapsedMs: 0,
    subQueriesCompleted: 0,
    roundsCompleted: 0,
    llmCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
  };
  try {
    if (row.stats) stats = { ...stats, ...JSON.parse(String(row.stats)) };
  } catch { /* ignore */ }

  const createdAt = row.created_at ? new Date(String(row.created_at)).getTime() : now;
  const updatedAt = row.updated_at ? new Date(String(row.updated_at)).getTime() : now;
  const status = String(row.status || "completed") as ResearchStatus;

  return {
    id: String(row.id),
    query: String(row.query || ""),
    status,
    createdAt,
    updatedAt,
    finishedAt: (status === "completed" || status === "failed") ? updatedAt : undefined,
    config: { query: String(row.query || ""), depth: "standard", numSubQueries: 5, maxLinksPerQuery: 5, pageReadConcurrency: 3, reportMaxTokens: 4000, retriever: "duckduckgo", llmProvider: "nvidia", enableMultiRound: true, numGapQueries: 3 } as ResearchConfig,
    plan,
    gapAnalysis: null,
    round2FollowUps: [],
    subQueries: [],
    sources,
    report: row.report ? String(row.report) : null,
    logs: [],
    thoughts: [],
    followUpQuestions: [],
    clarifyingQuestions: [],
    error: null,
    stats,
    cancelled: false,
    abortController: new AbortController(),
    reportStream: [],
    reportStreaming: false,
  };
}

export function createJob(
  query: string,
  config: ResearchConfig,
  clientIP?: string
): ResearchJob {
  const jobs = getStore();

  if (jobs.size >= MAX_JOBS) {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.updatedAt > JOB_TTL_MS && !ACTIVE_STATUSES.has(job.status)) {
        jobs.delete(id);
      }
    }
  }

  if (jobs.size >= MAX_JOBS) {
    let oldestId: string | null = null;
    let oldestTs = Infinity;
    for (const [id, job] of jobs) {
      if (ACTIVE_STATUSES.has(job.status)) continue;
      if (job.updatedAt < oldestTs) {
        oldestTs = job.updatedAt;
        oldestId = id;
      }
    }
    if (oldestId) jobs.delete(oldestId);
  }

  const id = randomUUID();
  const now = Date.now();
  const job: ResearchJob = {
    id,
    query,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    config,
    plan: null,
    gapAnalysis: null,
    round2FollowUps: [],
    subQueries: [],
    sources: [],
    report: null,
    logs: [],
    thoughts: [],
    followUpQuestions: [],
    clarifyingQuestions: [],
    error: null,
    stats: {
      totalPagesFound: 0,
      totalPagesRead: 0,
      totalPagesSucceeded: 0,
      totalTokensUsed: 0,
      elapsedMs: 0,
      subQueriesCompleted: 0,
      roundsCompleted: 0,
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    },
    clientIP,
    cancelled: false,
    abortController: new AbortController(),
    reportStream: [],
    reportStreaming: false,
  };
  jobs.set(id, job);

  // Persist to DB so the job survives server restarts.
  persistJob(job);

  return job;
}

/**
 * Get a job by ID.
 * 1. Check in-memory Map first (active jobs with full runtime state).
 * 2. If not found, check the DB (completed/failed jobs that survived a restart).
 */
export function getJob(id: string): ResearchJob | undefined {
  // 1. In-memory (fast path, full runtime state).
  const memJob = getStore().get(id);
  if (memJob) return memJob;

  // 2. DB (slow path, essential fields only).
  if (dbAvailable === false) return undefined;
  const db = getDb();
  if (!db) return undefined;

  try {
    const row = db.prepare(
      "SELECT * FROM research_jobs WHERE id = ?"
    ).get(id) as Record<string, unknown> | undefined;

    if (row) {
      const job = recordToJob(row);
      // Cache in memory so subsequent calls are fast.
      getStore().set(id, job);
      return job;
    }
  } catch (err) {
    console.warn("[research-store] getJob DB query failed:", err instanceof Error ? err.message : String(err));
  }

  return undefined;
}

export function listJobs(): ResearchJob[] {
  // Merge in-memory jobs with DB jobs.
  const memJobs = Array.from(getStore().values());
  const memIds = new Set(memJobs.map((j) => j.id));

  const dbJobs: ResearchJob[] = [];
  if (dbAvailable !== false) {
    const db = getDb();
    if (db) {
      try {
        const rows = db.prepare(
          "SELECT * FROM research_jobs ORDER BY datetime(created_at) DESC LIMIT 100"
        ).all() as Record<string, unknown>[];
        for (const row of rows) {
          const id = String(row.id);
          if (!memIds.has(id)) {
            dbJobs.push(recordToJob(row));
          }
        }
      } catch (err) {
        console.warn("[research-store] listJobs DB query failed:", err instanceof Error ? err.message : String(err));
      }
    }
  }

  // Merge and sort by createdAt desc.
  return [...memJobs, ...dbJobs].sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteJob(id: string): boolean {
  const deletedFromMem = getStore().delete(id);

  // Also delete from DB.
  if (dbAvailable !== false) {
    const db = getDb();
    if (db) {
      try {
        db.prepare("DELETE FROM research_jobs WHERE id = ?").run(id);
      } catch {
        /* ignore */
      }
    }
  }

  return deletedFromMem;
}

// Get all jobs that are currently active (not completed/failed).
// Used by /api/sessions to show in-progress research in the History drawer.
export function getActiveJobs(): ResearchJob[] {
  return Array.from(getStore().values())
    .filter((j) => ACTIVE_STATUSES.has(j.status))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
