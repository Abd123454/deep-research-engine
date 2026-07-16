// BullMQ job queues — background processing for research, email, memory.
//
// Requires Redis (REDIS_URL env var). If Redis is not configured,
// the system falls back to synchronous processing.

import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { logger } from "./logger";

let connection: IORedis | null = null;

function getConnection(): IORedis | null {
  if (connection) return connection;
  if (!process.env.REDIS_URL) return null;
  try {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    logger.info("Redis connected for BullMQ");
    return connection;
  } catch (err) {
    logger.error({ err }, "Failed to connect to Redis for BullMQ");
    return null;
  }
}

export function isQueueAvailable(): boolean {
  return getConnection() !== null;
}

// ---------- Queues ----------

let researchQueue: Queue | null = null;
let emailQueue: Queue | null = null;
let memoryQueue: Queue | null = null;

function getResearchQueue(): Queue | null {
  if (!researchQueue) {
    const conn = getConnection();
    if (!conn) return null;
    researchQueue = new Queue("research", { connection: conn });
  }
  return researchQueue;
}

function getEmailQueue(): Queue | null {
  if (!emailQueue) {
    const conn = getConnection();
    if (!conn) return null;
    emailQueue = new Queue("email", { connection: conn });
  }
  return emailQueue;
}

function getMemoryQueue(): Queue | null {
  if (!memoryQueue) {
    const conn = getConnection();
    if (!conn) return null;
    memoryQueue = new Queue("memory", { connection: conn });
  }
  return memoryQueue;
}

// ---------- Enqueue helpers ----------

export async function enqueueResearch(
  jobId: string,
  query: string,
  userId: string
): Promise<void> {
  const queue = getResearchQueue();
  if (!queue) {
    logger.warn({ jobId }, "Redis not configured, research will run synchronously");
    return;
  }
  await queue.add(
    "research",
    { jobId, query, userId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
  logger.info({ jobId, query: query.slice(0, 60) }, "Research job enqueued");
}

export async function enqueueEmail(
  to: string,
  template: string,
  props: Record<string, unknown>
): Promise<void> {
  const queue = getEmailQueue();
  if (!queue) return;
  await queue.add(
    "email",
    { to, template, props },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 10000 },
    }
  );
}

export async function enqueueMemoryExtraction(
  userId: string,
  conversation: string
): Promise<void> {
  const queue = getMemoryQueue();
  if (!queue) return;
  await queue.add("memory", { userId, conversation }, { attempts: 2 });
}

// ---------- Workers (for the worker process) ----------

export function createResearchWorker(
  processor: (job: { jobId: string; query: string; userId: string }) => Promise<void>
): Worker | null {
  const conn = getConnection();
  if (!conn) return null;
  return new Worker(
    "research",
    async (job) => {
      logger.info({ jobId: job.data.jobId, attempt: job.attemptsMade + 1 }, "Processing research job");
      await processor(job.data);
    },
    { connection: conn }
  );
}

export function createEmailWorker(
  processor: (job: { to: string; template: string; props: Record<string, unknown> }) => Promise<void>
): Worker | null {
  const conn = getConnection();
  if (!conn) return null;
  return new Worker("email", async (job) => processor(job.data), { connection: conn });
}

export function createMemoryWorker(
  processor: (job: { userId: string; conversation: string }) => Promise<void>
): Worker | null {
  const conn = getConnection();
  if (!conn) return null;
  return new Worker("memory", async (job) => processor(job.data), { connection: conn });
}

// ---------- Cleanup ----------

export async function closeQueues(): Promise<void> {
  await researchQueue?.close();
  await emailQueue?.close();
  await memoryQueue?.close();
  await connection?.quit();
}
