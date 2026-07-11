// In-memory research job store with TTL eviction.
// Jobs are kept in process memory; sufficient for a single-instance demo.
//
// NOTE: In Next.js dev mode with Turbopack, modules can be re-evaluated,
// which would reset a module-level Map. To survive HMR and route-module
// reloads, we stash the Map on `globalThis` so it persists across reloads.

import { randomUUID } from "crypto";
import type { ResearchJob, ResearchConfig } from "./types";

const MAX_JOBS = 30;
const JOB_TTL_MS = 1000 * 60 * 60; // 1 hour

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

export function createJob(query: string, config: ResearchConfig): ResearchJob {
  const jobs = getStore();

  // Evict expired jobs if we're at capacity.
  if (jobs.size >= MAX_JOBS) {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.updatedAt > JOB_TTL_MS) {
        jobs.delete(id);
      }
    }
  }
  // If still at capacity, drop oldest.
  if (jobs.size >= MAX_JOBS) {
    let oldestId: string | null = null;
    let oldestTs = Infinity;
    for (const [id, job] of jobs) {
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
    },
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
      `[research-store] getJob(${id}) NOT FOUND. Store size: ${jobs.size}. IDs: ${Array.from(jobs.keys()).slice(0, 5).join(", ")}`
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
