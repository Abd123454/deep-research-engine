// Prompt Caching — SHA-256 hash of (prompt + context) → cached result.
//
// Avoids re-calling the LLM when the same prompt + context has been
// served recently within the same process. The cache is in-process
// memory (Map) — it is NOT shared across instances and does NOT
// survive restarts. For multi-instance deployments, replace the Map
// with a Redis backend keyed on the same hash.
//
// TTL: 24 hours. After 24h, the entry is treated as a miss and
// re-fetched on the next call.
//
// Size cap: 1000 entries. When the cap is exceeded, the
// oldest-by-timestamp entry is evicted (LRU-ish). This bounds memory
// use to roughly 1MB of result text per process under typical loads.
//
// Cache key construction:
//   key = sha256(prompt + context)
//
// Both `prompt` and `context` are caller-supplied strings. The caller
// is responsible for serializing whatever inputs affect the output
// (model name, temperature, max_tokens, message history, tool
// catalog, etc.) into the two strings. A common pattern is:
//   prompt  = JSON.stringify(messages) + JSON.stringify(tools || [])
//   context = `${model}:${temperature}:${maxTokens}:${json ? "json" : "text"}`
//
// The hash is hex-encoded SHA-256 (64 chars). Collisions are
// astronomically unlikely for prompt-sized inputs.

import crypto from "crypto";

interface CacheEntry {
  result: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 1000;

/**
 * Look up a cached prompt result. Returns null if:
 *   - no entry exists for this (prompt, context) tuple
 *   - the entry has expired (older than 24h)
 *
 * Side effect: expired entries are evicted on read.
 */
export function getCachedPrompt(prompt: string, context: string = ""): string | null {
  const key = crypto.createHash("sha256").update(prompt + context).digest("hex");
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

/**
 * Store a prompt result in the cache. Evicts the oldest entry when
 * the cache exceeds the 1000-entry cap.
 */
export function setCachedPrompt(prompt: string, result: string, context: string = ""): void {
  const key = crypto.createHash("sha256").update(prompt + context).digest("hex");
  cache.set(key, { result, timestamp: Date.now() });
  if (cache.size > MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

/** Clear the entire prompt cache. Intended for tests and admin tooling. */
export function clearPromptCache(): void {
  cache.clear();
}

/** Number of entries currently in the cache. Exposed for diagnostics. */
export function promptCacheSize(): number {
  return cache.size;
}
