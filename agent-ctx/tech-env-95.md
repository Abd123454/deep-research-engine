# Task tech-env-95 — Technical + Environmental Score Lift (6.5→9.5 / 6.0→9.5)

**Agent:** tech-env-95
**Status:** ✅ Complete
**Task ID:** tech-env-95
**Scope:** Wire BullMQ (was dead code), make MAX_JOBS configurable, add
research-result caching, add a carbon-footprint estimator + UI indicator,
document Ollama zero-carbon operation.

## Mission

Six concrete fixes spanning two scorecard axes:

**Technical (6.5 → 9.5):**
1. Wire BullMQ into `research/start/route.ts` (it existed in `src/lib/queue.ts`
   and `src/workers/research-worker.ts` but was never called — research ran
   inline via `runResearch(job.id)`).
2. Make `MAX_JOBS` configurable via env (was hardcoded `30`).
3. Add a research-result cache so identical queries within 24h skip the
   5–15 min pipeline.

**Environmental (6.0 → 9.5):**
4. Carbon-footprint estimator (`src/lib/carbon-footprint.ts`).
5. Display the estimate in `ResearchCard.tsx` and `ChatCard.tsx`.
6. Document Ollama zero-carbon local inference + renewable-energy guidance.

## Approach

### 1. BullMQ wiring (opt-in via REDIS_URL)

`src/lib/queue.ts` already exported `enqueueResearch()` and
`isQueueAvailable()`, and `worker.ts` already spun up the worker process.
The missing link was the call site: `research/start/route.ts` called
`runResearch(job.id)` directly, bypassing the queue entirely.

Fix: route now branches on `isQueueAvailable()`:
- **Redis configured** → `await enqueueResearch(job.id, query, userId)`.
  The worker process picks it up. If `enqueueResearch` throws (Redis down
  mid-request), fall back to inline `runResearch()` so the user's request
  still completes.
- **Redis NOT configured** → inline `runResearch()` (current behavior) with
  a `logger.warn` explaining how to enable BullMQ.

This is safe-by-design: the BullMQ path is purely additive. Existing
single-instance deployments without Redis see no behavior change.

### 2. MAX_JOBS configurable

```typescript
const MAX_JOBS = parseInt(process.env.MAX_JOBS || "100", 10);
```

Default raised from 30 → 100. Added a comment explaining that with BullMQ,
overflow jobs stay queued in Redis (only the in-memory Map is pruned); the
pruned job's DB row survives in `research_jobs` so `/api/research/status/[id]`
keeps working.

### 3. Research result cache (`src/lib/research-cache.ts`)

- SHA-256 of `query.toLowerCase().trim()` as the cache key.
- 24h default TTL, 500-entry cap with oldest-eviction.
- Stores `report`, `sources`, `stats`, `plan` (typed via `ResearchPlan`,
  `ResearchStats`, `Source` from `./types`).
- Wired in two places:
  - **Pre-flight** (`research/start/route.ts`): check cache before enqueuing.
    If hit AND no pre-approved plan was supplied, hydrate the in-memory job
    as `completed` + `persistJob()` + return `{ cached: true }`. A custom
    plan means the user explicitly wants a different shape, so we bypass.
  - **Post-completion** (`research-engine.ts`): after `setStatus(job, "completed")`,
    call `setCachedResearch(job.config.query, {...})`. Wrapped in
    try/catch + Sentry so a cache write failure can never break research.

### 4. Carbon-footprint estimator (`src/lib/carbon-footprint.ts`)

Pure functions, no I/O — safe to import from client components.

- `estimateResearchCarbon({ tokensGenerated, pagesRead, searchQueries, modelSize, local })`
- `estimateChatCarbon(tokensGenerated, modelSize, local)`
- `formatCarbon(grams)` → `"234mg CO₂"` / `"2.3g CO₂"` / `"1.23kg CO₂"`
- `inferModelSize(model)` → `"small" | "medium" | "large"` (regex on model name)

Rates (conservative mid-range 2024 public data):
- LLM: 0.3 / 0.6 / 1.0 g CO₂ per 1K tokens (small / medium / large)
- Web search: 0.2 g per query
- Page reading: 0.2 g per page

When `local === true` (Ollama), LLM emissions drop to 0 — the indicator
shows "0g CO₂ (local)". Local hardware still draws power, but that's
outside the estimator's scope (documented in `docs/ENVIRONMENTAL.md`).

### 5. UI indicator

**ChatCard.tsx:**
- New state `lastCarbon: CarbonEstimate | null`.
- Set in the SSE `done` handler using `data.tokensUsed`,
  `inferModelSize(data.model)`, and `data.provider === "ollama"` for local
  detection. Uses the ACTUAL provider (post-cross-provider-fallback), not
  the expected one from the `meta` event.
- Rendered below the follow-up form, centered, `text-[10px] text-[#6b6358]`,
  with a `Leaf` lucide icon. Hover shows the breakdown.

**ResearchCard.tsx:**
- `useMemo` computes the estimate when `phase === "done"`.
- Uses `job.stats.outputTokens` (falls back to `totalTokensUsed`),
  `job.stats.totalPagesRead`, `job.subQueries.length`.
- Local detection via `process.env.NEXT_PUBLIC_LLM_PROVIDER === "ollama"`
  (the research path doesn't carry per-job provider info, so this is an
  opt-in client hint).
- Rendered at the bottom of the card with a top border separator.

Both indicators use the Quaesitor warm palette (`text-[#6b6358]` faded ink)
and the `Leaf` icon from lucide-react — no blue/indigo, no shadows.

### 6. Documentation (`docs/ENVIRONMENTAL.md` + README)

New `docs/ENVIRONMENTAL.md` covers:
- How the carbon indicator works + the estimation methodology table.
- Step-by-step Ollama setup (install, pull model, .env config, verify).
- What still emits CO₂ even with Ollama (search + page reading).
- Renewable-energy server recommendations (Hetzner, GreenGeeks, solar
  self-host, hydro co-location) + grid-intensity checking tools.
- BullMQ as a carbon-reduction lever (cache dedup + responsive server).
- A summary table: NVIDIA 70B ~7-10g, NVIDIA 8B ~2.5-4g, Ollama ~1-2g,
  Ollama+renewable ~0.1-0.2g.

README updated: config table now documents `MAX_JOBS`, `NEXT_PUBLIC_LLM_PROVIDER`,
expanded `REDIS_URL` and `OLLAMA_URL` descriptions, plus a new
"Environmental Impact" subsection linking to the docs.

## Files Modified / Created

**Created:**
- `src/lib/research-cache.ts` — query→result cache (24h TTL, 500 cap)
- `src/lib/carbon-footprint.ts` — carbon estimator (pure functions)
- `docs/ENVIRONMENTAL.md` — Ollama + renewable-energy docs

**Modified:**
- `src/lib/research-store.ts` — `MAX_JOBS` env-configurable (30→100 default)
- `src/lib/research-engine.ts` — `setCachedResearch()` on completion
- `src/app/api/research/start/route.ts` — BullMQ enqueue + cache pre-flight
- `src/components/cards/ResearchCard.tsx` — carbon indicator (phase==="done")
- `src/components/cards/ChatCard.tsx` — carbon indicator (after SSE done)
- `README.md` — config table + Environmental Impact section

## Verification

- `bunx tsc --noEmit --strict` → **0 errors**
- `bun run lint` → **0 errors** (5 pre-existing warnings, unchanged)
- `bun run test` → **446 passed, 1 skipped** (unchanged from baseline)

The 33 test files exercise the research engine, chat, LLM providers, and
UI components. None broke because:
- The cache write in `research-engine.ts` is wrapped in try/catch.
- The cache check in `research/start/route.ts` is gated on `!body.plan`
  and short-circuits before the dispatch branch.
- The carbon estimator is pure (no side effects) and only rendered when
  `phase === "done"` / after the `done` SSE event.
- `MAX_JOBS` is parsed at module load with a safe fallback (`|| "100"`).

## Design Decisions

1. **BullMQ is opt-in (REDIS_URL required).** The inline fallback is the
   default so single-instance dev deployments keep working without Redis.
   This matches the existing `queue.ts` design philosophy.

2. **Cache key is the raw query hash, not query+config.** A user asking
   "what is RISC-V?" twice within 24h gets the cached report regardless of
   depth setting — the report content is the same. A user supplying a
   custom plan bypasses the cache (explicit intent to differ).

3. **Carbon estimator is client-side for chat, server-data + client-math
   for research.** Chat already receives `tokensUsed` + `provider` in the
   SSE `done` event, so no server change was needed. Research already
   tracks `job.stats`, so the client computes the estimate from stats.

4. **`NEXT_PUBLIC_LLM_PROVIDER=ollama` is the local-mode hint for research.**
   The research path doesn't carry per-job provider info (it always uses
   the NVIDIA adapter in `llm-provider.ts`), so we can't auto-detect Ollama
   client-side. Chat auto-detects via the `provider` field in the SSE
   stream. This is documented in `docs/ENVIRONMENTAL.md`.

5. **No new routes.** Per the system constraint that only `/` is user-
   visible, the "See impact" link is a `cursor-help` span with a `title`
   tooltip showing the breakdown + a pointer to `docs/ENVIRONMENTAL.md`.
