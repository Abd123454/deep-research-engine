// in-memory job store. needs Postgres/Redis for production.

import { randomUUID } from "crypto";
import type { ResearchJob, ResearchConfig, ResearchStatus } from "./types";

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
    },
    clientIP,
    cancelled: false,
    reportStream: [],
    reportStreaming: false,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): ResearchJob | undefined {
  return getStore().get(id);
}

export function listJobs(): ResearchJob[] {
  return Array.from(getStore().values()).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function deleteJob(id: string): boolean {
  return getStore().delete(id);
}

// Get all jobs that are currently active (not completed/failed).
// Used by /api/sessions to show in-progress research in the History drawer.
export function getActiveJobs(): ResearchJob[] {
  return Array.from(getStore().values())
    .filter((j) => ACTIVE_STATUSES.has(j.status))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
