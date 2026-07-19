// Research result cache — avoids re-running identical deep research queries.
//
// Cache key: SHA-256 of the normalized query (lowercased + trimmed) + ":" + userId.
// The userId MUST be part of the key so one user's cached research results are
// never served to another user — research outputs may reflect private context
// (memory, prior conversations, plan-limited quotas) that is per-user.
//
// Default TTL: 24 hours. Entries are stored in-memory (Map) — sufficient
// for single-instance deployments; multi-instance deployments should use
// Redis (see src/lib/redis.ts).
//
// The cache stores the full ResearchJob essential fields (report, sources,
// stats) so a cache hit can be returned as a completed job without re-running
// the pipeline.
//
// Anti-growth: the cache is capped at 500 entries. When exceeded, the oldest
// entry (by insertion timestamp) is evicted. This is a simple LRU-ish policy
// — full LRU would track last-access time, but for a research cache the
// insertion order is a good enough proxy (recent queries are more likely to
// be re-asked than ancient ones).

import crypto from "crypto";
import { logger } from "./logger";
import type { ResearchPlan, ResearchStats, Source } from "./types";

export interface CachedResearchResult {
  report: string | null;
  sources: Source[];
  stats: ResearchStats;
  plan: ResearchPlan | null;
  query: string;
  cachedAt: number;
}

interface CacheEntry {
  result: CachedResearchResult;
  timestamp: number;
  ttl: number;
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 500;

function getCache(): Map<string, CacheEntry> {
  const g = globalThis as typeof globalThis & {
    __researchResultCache?: Map<string, CacheEntry>;
  };
  if (!g.__researchResultCache) {
    g.__researchResultCache = new Map<string, CacheEntry>();
  }
  return g.__researchResultCache;
}

function hashQuery(query: string, userId: string): string {
  // A-3: include userId in the cache key so one user's cached results are
  // never served to another user (research output may reflect private
  // per-user context — memory, prior conversations, plan-limited quotas).
  return crypto
    .createHash("sha256")
    .update(query.toLowerCase().trim() + ":" + userId)
    .digest("hex");
}

/**
 * Look up a cached research result by query + userId.
 * Returns null on miss or expired entry.
 */
export function getCachedResearch(
  query: string,
  userId: string
): CachedResearchResult | null {
  if (!query || query.trim().length === 0) return null;
  const key = hashQuery(query, userId);
  const cache = getCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  logger.debug({ module: "research-cache", key: key.slice(0, 12) }, "Cache hit");
  return entry.result;
}

/**
 * Store a research result in the cache (keyed by query + userId).
 * Evicts the oldest entry if the cache exceeds MAX_CACHE_SIZE.
 */
export function setCachedResearch(
  query: string,
  userId: string,
  result: Omit<CachedResearchResult, "query" | "cachedAt">,
  ttl = DEFAULT_TTL
): void {
  if (!query || query.trim().length === 0) return;
  const key = hashQuery(query, userId);
  const cache = getCache();

  const entry: CacheEntry = {
    result: {
      ...result,
      query,
      cachedAt: Date.now(),
    },
    timestamp: Date.now(),
    ttl,
  };
  cache.set(key, entry);

  // Prevent unbounded growth: evict oldest entries when over cap.
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = [...cache.entries()].sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    )[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

/**
 * Clear the entire research cache. Useful for tests and admin tooling.
 */
export function clearResearchCache(): void {
  getCache().clear();
}

/**
 * Cache stats — used by the health endpoint and admin dashboard.
 * `hitRate` is 0 unless externally tracked (the cache itself doesn't
 * track hits/misses to avoid hot-path overhead).
 */
export function getCacheStats(): { size: number; hitRate: number } {
  return { size: getCache().size, hitRate: 0 };
}
