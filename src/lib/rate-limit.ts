// Rate limiter — Redis-backed (production) with in-memory fallback (development).
//
// Limits per client IP:
//   - max 5 research starts per minute (burst protection)
//   - max 3 concurrent researches per IP
//   - max 50 researches per day (daily quota)
//
// When REDIS_URL is set, uses Redis sorted sets for sliding-window counters
// (works across multiple instances). Otherwise falls back to in-memory Map.

import { getRedis } from "./redis";

interface RateLimitResult {
  ok: boolean;
  reason?: string;
  retryAfterSec?: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_STARTS = 5;
const MAX_CONCURRENT = 3;
const MAX_DAILY = 50;

// ---------- In-memory fallback ----------

interface MemoryBucket {
  starts: number[];
  concurrent: number;
  daily: number[];
}

const memoryBuckets = new Map<string, MemoryBucket>();

function getMemoryBucket(ip: string): MemoryBucket {
  let b = memoryBuckets.get(ip);
  if (!b) {
    b = { starts: [], concurrent: 0, daily: [] };
    memoryBuckets.set(ip, b);
  }
  return b;
}

function memoryRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const bucket = getMemoryBucket(ip);
  bucket.starts = bucket.starts.filter((t) => now - t < WINDOW_MS);
  bucket.daily = bucket.daily.filter((t) => now - t < 86400000);

  if (bucket.daily.length >= MAX_DAILY) {
    return { ok: false, reason: `Daily limit exceeded (${MAX_DAILY}/day).`, retryAfterSec: 86400 };
  }
  if (bucket.concurrent >= MAX_CONCURRENT) {
    return { ok: false, reason: `Too many concurrent researches (max ${MAX_CONCURRENT}).` };
  }
  if (bucket.starts.length >= MAX_STARTS) {
    const oldest = bucket.starts[0] ?? now;
    const retryAfterSec = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { ok: false, reason: `Rate limit: max ${MAX_STARTS}/min. Try again in ${retryAfterSec}s.`, retryAfterSec };
  }

  bucket.starts.push(now);
  bucket.daily.push(now);
  bucket.concurrent++;
  return { ok: true };
}

// ---------- Redis-backed ----------

async function redisRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = getRedis()!;
  const now = Date.now();
  const key = `ratelimit:${ip}`;

  const pipeline = redis.pipeline();
  pipeline.zadd(`${key}:starts`, now, now.toString());
  pipeline.zremrangebyscore(`${key}:starts`, 0, now - WINDOW_MS);
  pipeline.zcard(`${key}:starts`);
  pipeline.get(`${key}:concurrent`);
  pipeline.zadd(`${key}:daily`, now, now.toString());
  pipeline.zremrangebyscore(`${key}:daily`, 0, now - 86400000);
  pipeline.zcard(`${key}:daily`);
  pipeline.expire(`${key}:starts`, 60);
  pipeline.expire(`${key}:daily`, 86400);

  const results = await pipeline.exec();
  const startsCount = (results?.[2]?.[1] as number) ?? 0;
  const concurrent = parseInt((results?.[3]?.[1] as string) ?? "0", 10);
  const dailyCount = (results?.[6]?.[1] as number) ?? 0;

  if (dailyCount > MAX_DAILY) {
    return { ok: false, reason: `Daily limit exceeded (${MAX_DAILY}/day).`, retryAfterSec: 86400 };
  }
  if (concurrent >= MAX_CONCURRENT) {
    return { ok: false, reason: `Too many concurrent researches (max ${MAX_CONCURRENT}).` };
  }
  if (startsCount > MAX_STARTS) {
    return { ok: false, reason: `Rate limit: max ${MAX_STARTS}/min.`, retryAfterSec: 60 };
  }

  await redis.incr(`${key}:concurrent`);
  await redis.expire(`${key}:concurrent`, 300);
  return { ok: true };
}

// ---------- Public API ----------

/** Check whether a new research start is allowed. Async (Redis) or sync (memory). */
export async function checkStartRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redisRateLimit(ip);
    } catch (err) {
      console.warn("[rate-limit] Redis failed, falling back to memory:", err instanceof Error ? err.message : String(err));
    }
  }
  return memoryRateLimit(ip);
}

/** Decrement the concurrent counter when a research finishes. */
export function releaseConcurrency(ip: string): void {
  const redis = getRedis();
  if (redis) {
    redis.decr(`ratelimit:${ip}:concurrent`).catch(() => {});
    return;
  }
  const bucket = memoryBuckets.get(ip);
  if (bucket && bucket.concurrent > 0) bucket.concurrent--;
}

/** Extract client IP from a Next.js request. */
export function getClientIP(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Periodic cleanup of stale memory buckets.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of memoryBuckets) {
      bucket.starts = bucket.starts.filter((t) => now - t < WINDOW_MS);
      if (bucket.starts.length === 0 && bucket.concurrent === 0) {
        memoryBuckets.delete(ip);
      }
    }
  }, 5 * 60_000).unref?.();
}
