// In-memory research job store with TTL eviction.
// Jobs are kept in process memory; sufficient for a single-instance demo.

import { randomUUID } from "crypto";
import type { ResearchJob, ResearchConfig } from "./types";

const MAX_JOBS = 20;
const JOB_TTL_MS = 1000 * 60 * 60; // 1 hour

const jobs = new Map<string, ResearchJob>();

export function createJob(query: string, config: ResearchConfig): ResearchJob {
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
  return job;
}

export function getJob(id: string): ResearchJob | undefined {
  return jobs.get(id);
}

export function listJobs(): ResearchJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteJob(id: string): boolean {
  return jobs.delete(id);
}
