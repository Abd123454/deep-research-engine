// rate limiter
//
// Limits per client IP:
//   - max 5 research starts per minute (burst protection)
//   - max 3 concurrent researches per IP
//
// This protects the NVIDIA free-tier quotas from being exhausted by a
// single abusive client. Uses a sliding-window counter in process memory.
//

interface RateBucket {
  starts: number[]; // timestamps of recent starts (sliding 60s window)
  concurrent: number; // current in-flight researches
}

const buckets = new Map<string, RateBucket>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_STARTS_PER_WINDOW = 5;
const MAX_CONCURRENT = 3;

function getBucket(ip: string): RateBucket {
  let b = buckets.get(ip);
  if (!b) {
    b = { starts: [], concurrent: 0 };
    buckets.set(ip, b);
  }
  return b;
}

function pruneOldStarts(bucket: RateBucket, now: number): void {
  const cutoff = now - WINDOW_MS;
  bucket.starts = bucket.starts.filter((t) => t > cutoff);
}

export interface RateLimitResult {
  ok: boolean;
  reason?: string;
  retryAfterSec?: number;
}

/** Check whether a new research start is allowed for the given IP. */
export function checkStartRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const bucket = getBucket(ip);
  pruneOldStarts(bucket, now);

  if (bucket.concurrent >= MAX_CONCURRENT) {
    return {
      ok: false,
      reason: `Too many concurrent researches (max ${MAX_CONCURRENT}). Please wait for one to finish.`,
    };
  }
  if (bucket.starts.length >= MAX_STARTS_PER_WINDOW) {
    const oldest = bucket.starts[0] ?? now;
    const retryAfterSec = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return {
      ok: false,
      reason: `Rate limit: max ${MAX_STARTS_PER_WINDOW} researches per minute. Try again in ${retryAfterSec}s.`,
      retryAfterSec,
    };
  }

  bucket.starts.push(now);
  bucket.concurrent += 1;
  return { ok: true };
}

/** Decrement the concurrent counter when a research finishes (success or failure). */
export function releaseConcurrency(ip: string): void {
  const bucket = buckets.get(ip);
  if (bucket && bucket.concurrent > 0) {
    bucket.concurrent -= 1;
  }
}

/** Extract client IP from a Next.js request (handles x-forwarded-for). */
export function getClientIP(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0]!.trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

// Periodic cleanup of stale buckets (every 5 minutes) to avoid memory growth.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS * 5; // keep 5 minutes of history
    for (const [ip, bucket] of buckets) {
      pruneOldStarts(bucket, now);
      if (bucket.starts.length === 0 && bucket.concurrent === 0) {
        // Only delete if the bucket has been fully idle for 5 min.
        const lastStart = bucket.starts[bucket.starts.length - 1] ?? 0;
        if (lastStart < cutoff) {
          buckets.delete(ip);
        }
      }
    }
  }, 5 * 60_000).unref?.();
}
