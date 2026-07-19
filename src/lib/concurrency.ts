// Bounded-concurrency helper for Promise.all(... .map(async ...)) patterns.
//
// 7b v5 audit fix: research-engine.ts and swarm.ts both fan out
// sub-tasks via Promise.all(items.map(async ...)). Unbounded fan-out
// can hit NVIDIA / OpenAI / Anthropic rate limits (429s) when the
// item count exceeds the provider's per-key concurrency. This helper
// caps concurrency at `maxConcurrent` (default 3, conservative for
// the NVIDIA free tier) by slicing the items into batches and
// awaiting each batch before starting the next.
//
// The function preserves item order in the returned array (unlike
// Promise.allSettled, which also preserves order but loses the
// rejection-shape). Callers that need to survive per-item rejections
// should `.catch()` inside their mapper — same pattern as the
// existing call sites, which already do `processSubQuery(...).catch(...)`.

/**
 * Run an async mapper over `items` with at most `maxConcurrent` in
 * flight at any time. Returns the results in the same order as
 * `items`.
 *
 * @example
 *   const results = await runWithConcurrency(
 *     subQueries,
 *     async (sq, i) => {
 *       log(`starting ${i + 1}/${subQueries.length}`);
 *       return processSubQuery(sq).catch(err => ({ error: err.message }));
 *     },
 *     3,
 *   );
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  maxConcurrent = 3,
): Promise<R[]> {
  // Defensive: maxConcurrent must be >= 1, otherwise we'd loop forever.
  const cap = Math.max(1, maxConcurrent);
  const results: R[] = [];
  for (let i = 0; i < items.length; i += cap) {
    const batch = items.slice(i, i + cap);
    const batchResults = await Promise.all(
      batch.map((item, j) => fn(item, i + j)),
    );
    results.push(...batchResults);
  }
  return results;
}
