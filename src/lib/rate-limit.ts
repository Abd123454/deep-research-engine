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
import { logger } from "./logger";

interface RateLimitResult {
  ok: boolean;
  reason?: string;
  retryAfterSec?: number;
}

const WINDOW_MS = 60_000; // 1 minute
const DAILY_WINDOW_MS = 86_400_000; // 24 hours
const MAX_STARTS = 5;
const MAX_CONCURRENT = 3;
const MAX_DAILY = 50;

// Memory-leak protection: hard cap on the in-memory Map. When exceeded,
// we aggressively prune entries with no recent activity (older than the
// shorter window — WINDOW_MS, which is 1 minute). Anything still active
// within the last minute is preserved so we don't drop rate-limit state
// for ongoing bursts.
const MAX_MAP_SIZE = 10_000;
// Periodic cleanup interval (5 minutes). Also runs lazily on every check
// when the Map exceeds MAX_MAP_SIZE.
const CLEANUP_INTERVAL_MS = 5 * 60_000;

// ---------- In-memory fallback ----------

interface MemoryBucket {
  starts: number[];
  concurrent: number;
  daily: number[];
  /** Last time this bucket was touched (used for cleanup ordering). */
  lastTouched: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();

function getMemoryBucket(ip: string): MemoryBucket {
  let b = memoryBuckets.get(ip);
  if (!b) {
    b = { starts: [], concurrent: 0, daily: [], lastTouched: Date.now() };
    memoryBuckets.set(ip, b);
  }
  return b;
}

/**
 * Drop buckets that have no activity within the cleanup window.
 *
 * A bucket is "stale" when ALL of:
 *   - no starts within WINDOW_MS
 *   - no daily entries within DAILY_WINDOW_MS
 *   - concurrent === 0
 *
 * Concurrent counters are preserved (a long-running research shouldn't be
 * forgotten just because it's been >1 min since it started).
 */
function cleanupStaleBuckets(now: number): number {
  let deleted = 0;
  for (const [ip, bucket] of memoryBuckets) {
    bucket.starts = bucket.starts.filter((t) => now - t < WINDOW_MS);
    bucket.daily = bucket.daily.filter((t) => now - t < DAILY_WINDOW_MS);
    if (
      bucket.starts.length === 0 &&
      bucket.daily.length === 0 &&
      bucket.concurrent === 0
    ) {
      memoryBuckets.delete(ip);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Aggressive prune used when the Map exceeds MAX_MAP_SIZE.
 *
 * Drops the oldest buckets first (by `lastTouched`), preserving any with
 * a non-zero `concurrent` count (so we never lose track of an in-flight
 * research's releaseConcurrency() call).
 */
function pruneOldestBuckets(targetSize: number): number {
  if (memoryBuckets.size <= targetSize) return 0;
  // Sort by lastTouched ascending; preserve concurrent > 0.
  const entries = Array.from(memoryBuckets.entries())
    .filter(([, b]) => b.concurrent === 0)
    .sort((a, b) => a[1].lastTouched - b[1].lastTouched);
  const toDelete = Math.max(0, memoryBuckets.size - targetSize);
  let deleted = 0;
  for (const [ip] of entries) {
    if (deleted >= toDelete) break;
    memoryBuckets.delete(ip);
    deleted++;
  }
  return deleted;
}

function memoryRateLimit(ip: string): RateLimitResult {
  const now = Date.now();

  // Lazy cleanup: if the Map has grown past the hard cap, prune oldest
  // entries first, then run a full stale-bucket sweep. This bounds
  // memory usage under sustained traffic from many distinct IPs.
  if (memoryBuckets.size > MAX_MAP_SIZE) {
    const pruned = pruneOldestBuckets(Math.floor(MAX_MAP_SIZE * 0.9));
    const stale = cleanupStaleBuckets(now);
    if (pruned > 0 || stale > 0) {
      logger.warn(
        { module: "rate-limit", pruned, stale, remaining: memoryBuckets.size },
        "Rate-limit memory bucket map exceeded cap — pruned"
      );
    }
  }

  const bucket = getMemoryBucket(ip);
  bucket.lastTouched = now;
  bucket.starts = bucket.starts.filter((t) => now - t < WINDOW_MS);
  bucket.daily = bucket.daily.filter((t) => now - t < DAILY_WINDOW_MS);

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
      logger.warn(
        {
          module: "rate-limit",
          err: err instanceof Error ? err.message : String(err),
        },
        "Redis failed, falling back to memory"
      );
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
  if (bucket) {
    if (bucket.concurrent > 0) bucket.concurrent--;
    bucket.lastTouched = Date.now();
  }
}

/** Extract client IP from a Next.js request. */
export function getClientIP(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Periodic cleanup of stale memory buckets (every 5 minutes).
// Drops any bucket with no starts in the last minute, no daily entries
// in the last 24h, and zero in-flight concurrent researches.
//
// This bounds the Map's growth even under sustained traffic from many
// distinct IPs (DoS / scrapers). A lazy size-cap prune also runs inside
// `memoryRateLimit` whenever `MAX_MAP_SIZE` is exceeded, so we're
// protected even if the interval timer is delayed (e.g. by event-loop
// starvation).
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const deleted = cleanupStaleBuckets(now);
    if (deleted > 0) {
      logger.debug(
        { module: "rate-limit", deleted, remaining: memoryBuckets.size },
        "Periodic cleanup of stale rate-limit buckets"
      );
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}
