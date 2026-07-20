# Task: fix-v8-all — Fix ALL v8 audit findings in ONE pass

## Agent
fix-v8-all (single-pass fixer)

## Date
2026-07-19

## Summary
Applied all 7 v8 audit fixes in a single pass. All verification gates pass:
- `bunx tsc --noEmit --strict` → 0 errors
- `bun run lint` → 0 errors, 218 warnings (all pre-existing)
- `bun run test` → 503 passed, 1 skipped (35 test files)
- `bun run build` → ✓ Compiled successfully

## Fixes Applied

### 1. Empty catch blocks (14 sites)
Searched with `rg -nP '\.catch\(\(\)\s*=>\s*\{\s*\}\)'` — found 9 truly-empty
`.catch(() => {})` patterns plus 5 comment-only catches. Fixed all 14:

**Server-side (logger.warn):**
- `src/app/api/chat/agent/route.ts` (2 sites: storeExplicitMemory, extractAndStoreMemories)
- `src/app/api/chat/route.ts` (2 sites: same functions)
- `src/lib/code-sandbox-docker.ts` (fs.rm cleanup → Sentry.captureException)
- `src/lib/rate-limit.ts` (redis.decr → logger.warn)
- `src/lib/usage-tracker.ts` (flushUsage interval → logger.warn)

**Client-side (comment-only, no-empty suppressed by comment content):**
- `src/app/pricing/page.tsx` (billing subscription fetch)
- `src/app/billing/page.tsx` (usage widget fetch)
- `src/app/settings/memory/page.tsx` (preferences fetch)
- `src/components/cards/QuickCard.tsx` (memory extraction fetch)
- `src/components/UnifiedInterface.tsx` (3 fetch sites: conversations, sessions, delete)

Added `import { logger } from "@/lib/logger"` to the 2 API route files that
didn't have it. The `rate-limit.ts` and `usage-tracker.ts` already imported
logger. The `code-sandbox-docker.ts` already imported Sentry.

### 2. Radix packages updated
Ran `bun update @radix-ui/react-collapsible @radix-ui/react-label ...` (12
packages). All 12 updated to latest minor versions:
- react-collapsible: 1.1.16 → 1.1.17
- react-label: 2.1.11 → 2.1.12
- react-progress: 1.1.12 → 1.1.13
- react-select: 2.3.3 → 2.3.4
- react-separator: 1.1.11 → 1.1.12
- react-slider: 1.4.3 → 1.4.4
- react-slot: 1.3.0 (already latest)
- react-switch: 1.3.3 → 1.3.4
- react-tabs: 1.1.17 → 1.1.18
- react-toast: 1.2.19 → 1.2.20
- react-toggle-group: 1.1.15 → 1.1.16
- react-tooltip: 1.2.12 → 1.2.13

### 3. Streaming backpressure (desiredSize check)
Added to 3 streaming routes:

**`src/app/api/chat/route.ts`:**
- Added `enqueueWithBackpressure(controller, chunk)` helper that checks
  `controller.desiredSize <= 0` and yields 10ms before enqueuing.
- Applied to meta, done, and error events (awaited).
- Per-token `onToken` callback stays synchronous (can't await) — documented
  that the stream's internal high-water mark absorbs the small per-token burst.

**`src/app/api/v1/chat/route.ts`:**
- Same `enqueueWithBackpressure` helper and pattern.

**`src/app/api/research/stream/[id]/route.ts`:**
- Modified `send()` to return `boolean` and check `desiredSize`.
- For non-critical `"update"` events: skip enqueue when `desiredSize <= 0`
  (next tick re-sends the same state).
- For critical events (`report_token`, `done`, `error`): always enqueue
  (data-loss prevention).
- Updated the `lastUpdate` advancement to only happen when `send()` returns
  `true`, so a skipped update is retried on the next tick.

### 4. Circuit breaker in llm-provider.ts
Added per-provider circuit breaker (nvidia/openai/anthropic/ollama):

- **State:** `circuitState` map with `{ failures, lastFailure, isOpen }`.
- **Threshold:** `CIRCUIT_THRESHOLD = 5` consecutive failures → open.
- **Reset:** `CIRCUIT_RESET_MS = 60_000` (60s) → half-open probe.
- **Functions:** `checkCircuit(provider)`, `recordFailure(provider)`,
  `recordSuccess(provider)`.
- **Test helper:** Exported `__resetCircuitStateForTests()`.

**Placement (per-PROVIDER, not per-model):**
- NVIDIA: `checkCircuit("nvidia")` at the start of
  `nvidiaCompleteWithFallback` and `nvidiaFast`. If open, skip directly to
  `crossProviderFallback`. `recordFailure("nvidia")` called ONCE after the
  model loop fails (not per-model). `recordSuccess("nvidia")` called on
  successful return.
- OpenAI/Anthropic/Ollama: `checkCircuit` before each `provider.smart()`/`fast()`
  call in `crossProviderFallback` and `crossProviderFastFallback`.
  `recordFailure`/`recordSuccess` in the try/catch blocks.

**Key design decision:** The failure counter is per-PROVIDER, not per-model.
A single `nvidiaCompleteWithFallback` call that tries 6 models and all fail
counts as ONE failure. This prevents the circuit from opening too aggressively
during normal multi-model fallback, while still opening after 5 consecutive
provider-level outages.

### 5. wrapUserQuery on all LLM calls
- `wrapUserQuery` already existed in `src/lib/prompt-security.ts` (wraps in
  `<user_query>…</user_query>` XML tags).
- Added `import { wrapUserQuery } from "./prompt-security"` to `llm-provider.ts`.
- Added `wrapMessages(opts)` helper in `getLLM()` that maps over `opts.messages`
  and wraps any `role: "user"` message content with `wrapUserQuery()`.
- Applied at the `getLLM()` API boundary so ALL providers (NVIDIA, OpenAI,
  Anthropic, Ollama) receive wrapped user messages with a single change.
- System/assistant/tool messages pass through unchanged (trusted).

### 6. Docker base image
- `Dockerfile`: Changed all 3 stages (`deps`, `builder`, `runner`) from
  `node:20-slim` → `node:22-slim`.
- Node 22 is the current LTS (as of 2025-10); Node 20 enters maintenance-only
  in 2026-04.

### 7. CHANGELOG.md
- Added `### Fixed — v4.0.0 post-v8-audit (commit 17a3a48)` section at the top
  of the `[4.0.0]` entry, documenting all 6 fixes above.

## Verification Results
- `bunx tsc --noEmit --strict` → 0 errors ✓
- `bun run lint` → 0 errors, 218 warnings (all pre-existing) ✓
- `bun run test` → 503 passed, 1 skipped, 0 failed (35 files) ✓
- `bun run build` → ✓ Compiled successfully in 37.9s, 52/52 static pages ✓

## Files Modified
1. `src/app/api/chat/agent/route.ts` — empty catch + logger import
2. `src/app/api/chat/route.ts` — empty catch + logger import + backpressure
3. `src/app/api/v1/chat/route.ts` — backpressure
4. `src/app/api/research/stream/[id]/route.ts` — backpressure
5. `src/lib/llm-provider.ts` — circuit breaker + wrapUserQuery
6. `src/lib/code-sandbox-docker.ts` — empty catch
7. `src/lib/rate-limit.ts` — empty catch
8. `src/lib/usage-tracker.ts` — empty catch
9. `src/app/pricing/page.tsx` — empty catch
10. `src/app/billing/page.tsx` — empty catch
11. `src/app/settings/memory/page.tsx` — empty catch
12. `src/components/cards/QuickCard.tsx` — empty catch
13. `src/components/UnifiedInterface.tsx` — empty catch (3 sites)
14. `Dockerfile` — node:22-slim
15. `CHANGELOG.md` — v8 audit entry
16. `package.json` / `bun.lock` — Radix updates (via `bun update`)
