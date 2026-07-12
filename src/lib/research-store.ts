// In-memory research job store with TTL eviction.
// Jobs are kept in process memory; sufficient for a single-instance deployment.
//
// NOTE: In Next.js dev mode with Turbopack, modules can be re-evaluated,
// which would reset a module-level Map. To survive HMR and route-module
// reloads, we stash the Map on `globalThis` so it persists across reloads.
//
// NOTE: This store is NOT suitable for multi-instance / serverless deployments.
// For production, replace `JobStore` with a Postgres/Redis-backed implementation.

import { randomUUID } from "crypto";
import type { ResearchJob, ResearchConfig, ResearchStatus } from "./types";

const MAX_JOBS = 30;
const JOB_TTL_MS = 1000 * 60 * 60; // 1 hour

// Active statuses — jobs in these states must NEVER be evicted (data loss).
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

export function createJob(
  query: string,
  config: ResearchConfig,
  clientIP?: string
): ResearchJob {
  const jobs = getStore();

  // Evict expired jobs if we're at capacity.
  if (jobs.size >= MAX_JOBS) {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (
        now - job.updatedAt > JOB_TTL_MS &&
        !ACTIVE_STATUSES.has(job.status)
      ) {
        jobs.delete(id);
      }
    }
  }
  // If still at capacity, drop oldest NON-ACTIVE job.
  if (jobs.size >= MAX_JOBS) {
    let oldestId: string | null = null;
    let oldestTs = Infinity;
    for (const [id, job] of jobs) {
      // Never evict a job that's currently running.
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
    error: null,
    stats: {
      totalPagesFound: 0,
      totalPagesRead: 0,
      totalPagesSucceeded: 0,
      totalTokensUsed: 0,
      elapsedMs: 0,
      subQueriesCompleted: 0,
      roundsCompleted: 0,
    },
    clientIP,
  };
  jobs.set(id, job);
  console.log(`[research-store] created job ${id}, store size now ${jobs.size}`);
  return job;
}

export function getJob(id: string): ResearchJob | undefined {
  const jobs = getStore();
  const job = jobs.get(id);
  if (!job) {
    console.log(
      `[research-store] getJob(${id}) NOT FOUND. Store size: ${jobs.size}.`
    );
  }
  return job;
}

export function listJobs(): ResearchJob[] {
  return Array.from(getStore().values()).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function deleteJob(id: string): boolean {
  return getStore().delete(id);
}

