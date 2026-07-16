// abort-utils — shared cancellation helper.
//
// Combines an optional user-provided abort signal (e.g. from a research job
// or HTTP request) with a timeout signal. If either fires, the fetch is
// aborted. Extracted here so that page-reader and retriever do not duplicate
// the same logic.

/**
 * Combine a user-provided AbortSignal with a timeout.
 *
 * - If no user signal is given, returns a fresh timeout-only signal.
 * - If the user signal is already aborted, returns it as-is (fast-fail).
 * - If `AbortSignal.any` is available (Node 20+), returns a combined signal
 *   that fires when either the user signal or the timeout fires.
 * - Otherwise falls back to just the user signal (timeout is lost) — this
 *   only affects very old runtimes that lack `AbortSignal.any`.
 */
export function withAbortSignal(
  userSignal: AbortSignal | undefined,
  timeoutMs: number
): AbortSignal | undefined {
  if (!userSignal) return AbortSignal.timeout(timeoutMs);
  if (userSignal.aborted) return userSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([userSignal, AbortSignal.timeout(timeoutMs)]);
  }
  return userSignal;
}
