# final-10 — final push to 10/10 (2026-07-20)

**Agent:** final-10 (single-pass completionist)
**Task ID:** final-10
**Status:** ✅ ALL PASS — tsc 0 errors, lint 0 errors (216 warnings, all pre-existing),
503 tests pass + 1 skipped, build exit 0.

## What I read first

- `/home/z/my-project/worklog.md` — full history of prior agent passes.
  The most recent was `fix-v8-all` (v4.0.0 post-v8-audit) which left
  the project at 503 passing tests, 0 lint errors, build exit 0.
- `package.json` — version 4.0.0, next-auth ^4.24.14.
- `src/app/api/auth/[...nextauth]/route.ts` — full NextAuth v4 setup
  with the fail-closed NEXTAUTH_SECRET check + rate-limited POST
  handler.
- `src/lib/swarm.ts` — 742 lines, the god-object that needed further
  splitting (was already split into types.ts/roles.ts/index.ts in a
  prior pass).
- `src/components/{artifacts/ArtifactsPanel,canvas/CanvasPanel,collab/CollabIndicator,OnboardingFlow,PricingCalculator}.tsx`
  — the 5 RSC candidates the audit named.
- `src/lib/collab/collaboration.ts` + `src/lib/collab/collab-server.ts`
  + `src/lib/video-understanding/index.ts` — the P2 stubs to address.
- `docs/MIGRATION_NOTES.md` — existing migration plans (next-auth v5
  was already documented as PLANNED).
- `README.md` + `RELEASE_NOTES.md` — feature matrix + Known
  Limitations wording to update.

## Changes made

### 1. next-auth v4 → Auth.js v5 (DOCUMENTED, not migrated)

Auth.js v5 is still in beta (5.0.0-beta.31 as of 2026-07-20). The v5
API is a MAJOR breaking change:
- v4: `import NextAuth from "next-auth"` → `export default NextAuth(options)`
- v5: `import { handlers } from "@/auth"` → `export const { GET, POST } = handlers`

Migrating today would invalidate ~12 of the 503 tests (the ones that
reference `authOptions`, `rateLimitedHandler`, `findUserByEmail`,
`rehashPasswordIfNeeded`). The CVE situation does not justify the risk:

- The 3 high CVEs the audit repeatedly flags (`flatted`, `picomatch`,
  `minimatch`) are all in **eslint's** transitive dev/build deps —
  none reach the production runtime bundle.
- The `uuid@3` advisory in next-auth's bundled copy is **unreachable**
  in our usage (we never pass `buf` to `uuid.v3`/`v5`).

What I did instead:
1. Added a `@deprecated` banner at the top of the auth route with the
   full CVE situation analysis + a pointer to MIGRATION_NOTES.md.
2. Expanded MIGRATION_NOTES.md "next-auth v4 → Auth.js v5" section with:
   - Why we're NOT migrating today (4 reasons).
   - The 9-step migration plan when v5 ships stable.
   - The test-impact analysis (~12 tests need rewriting).
3. Verified `bun update next-auth` resolves to 4.24.14 (no newer v4
   patch exists — `bun pm view next-auth versions` shows 4.24.14 is
   the latest v4; 5.0.0-beta.31 is the latest v5 beta).

### 2. RSC: 5 listed components audited

After reading each file fully:

- `components/artifacts/ArtifactsPanel.tsx` — KEEP "use client"
  (uses `useState` × 4 [copied, activeTab, versions, activeVersionIdx],
  `useEffect`, `useRef` × 2, `onClick` handlers).
- `components/canvas/CanvasPanel.tsx` — KEEP "use client"
  (uses `useState` × 2 [editedContent, isDirty], `useRef`,
  `useEffect` × 2 [focus + reset], `onChange`/`onKeyDown`/`onClick`).
- `components/collab/CollabIndicator.tsx` — ALREADY a Server Component
  (no `"use client"` directive — was converted in v4.0.0
  post-reach-10-audit; no change needed).
- `components/OnboardingFlow.tsx` — KEEP "use client"
  (uses `useState` × 2 [visible, step], `useEffect` for localStorage
  check, `onClick` handlers, `localStorage` access).
- `components/PricingCalculator.tsx` — KEEP "use client"
  (uses `useState` × 4 [research, chat, useOwnOllama, prioritySupport],
  `useMemo` × 3 [recommendedPlan, baseCost, overage], `onChange`
  handlers on sliders + toggles).

**The "5+ more conversions" goal was infeasible.** After thorough
search of the remaining 54 client components (the shadcn/ui Radix
wrappers MUST stay client because Radix uses context; the page-level
components all do `useEffect`+`fetch` on mount; the cards all do
streaming SSE), none could be safely converted without a non-trivial
refactor that risks breaking the 503 tests. The audit's "5+ more"
goal is documented as infeasible without major refactoring work
(e.g. splitting billing/pricing pages into server+client halves).

### 3. swarm.ts: 742 → 400 lines (target was 500 — beat it)

Extracted:

- `src/lib/swarm/worker.ts` (365 lines): `runWorker` + the ReAct loop
  + loop-degeneration helpers (`detectToolCalls`, `stableStringify`,
  `hashToolCall`, `LOOP_DETECTION_THRESHOLD`,
  `MAX_PARALLEL_TOOL_CALLS`).
- `src/lib/swarm/orchestrator.ts` (183 lines): `planSwarm`,
  `synthesizeSwarm`, `validateRole`, `withTimeout`, and the per-phase
  timeout constants (`WORKER_TIMEOUT_MS`, `SYNTH_TIMEOUT_MS`).
- `swarm.ts` (400 lines): `runSwarm` (the entry point that wires
  plan → workers → synth), `serializeSSE`, and the dynamic subagent
  API (`createSubagent`/`assignTask`/`getSubagent`/`listSubagents`/
  `clearSubagents`) + its process-local registry.

All public symbols are re-exported from `swarm.ts` so
`import { runSwarm, planSwarm, runWorker, synthesizeSwarm,
serializeSSE, ... } from "@/lib/swarm"` keeps working unchanged.

Verified: all 11 swarm tests + 13 cross-test consumers (domain-agents,
verifier-loop, eval) pass without modification. The test file
(`src/lib/__tests__/swarm.test.ts`) imports from `../swarm` (the
file), and the swarm route + eval runner + verifier-loop tests all
import from `@/lib/swarm` — both paths resolve to the same
re-exported symbols.

### 4. P2 stubs: final decision

- `src/lib/collab/collaboration.ts` — **DELETED.** Verified NOT
  imported by any caller (`rg 'collab/collaboration' src/` returned
  0 hits). The production collab HTTP API
  (`/api/collab/[sessionId]/route.ts`) uses
  `src/lib/collab/collab-server.ts` directly, which has a real
  working in-memory session registry (not a stub). The high-level
  cursor/presence interface was dead code.

- `src/lib/video-understanding/index.ts` — **reduced to a "Not
  implemented" stub.** The task said "delete the stub files entirely
  and remove all imports. If deleting breaks imports, keep them but
  with a minimal stub that throws 'Not implemented' error." The
  video-understanding module IS imported by
  `/api/video/analyze/route.ts` (the only consumer) — deleting it
  would break the route. So per the task's fallback instruction, I
  kept a minimal stub:
  - `isVideoUnderstandingAvailable()` always returns `false`.
  - `analyzeVideo`/`extractKeyframes`/`transcribeVideo`/
    `buildVideoPrompt` throw "Not implemented: video understanding
    requires ffmpeg + Whisper".
  - Type exports preserved so the route compiles unchanged.
  - `VIDEO_CONFIG` preserved as informational constants.
  - The API route's existing availability gate
    (`if (!isVideoUnderstandingAvailable()) return 503`) means
    callers receive a clean 503 ("Video understanding is not
    available on this server") WITHOUT ever hitting the throw.

Documentation cleanup:
- `README.md`: removed the 2 🚧 rows for "Real-time collaboration"
  and "Video understanding" from the feature matrix.
- `RELEASE_NOTES.md`: updated the "Known Limitations" section to
  describe collab as "not wired up" (was "is a stub") and video as
  "not implemented" (was "is a stub").
- `docs/MIGRATION_NOTES.md`: rewrote the "Stub modules" section to
  document the deletions + the future re-enable plan.

### 5. npm audit: bun update + bun update next-auth

- `bun update` ran cleanly — only `@sentry/nextjs` bumped (10.66.0 →
  10.67.0).
- `bun update next-auth` resolved to 4.24.14 (no newer v4 patch
  exists).
- Still 18 vulnerabilities (10 high, 7 moderate, 1 low) — all in
  transitive dev/build deps:
  - `eslint`'s `flatted`/`picomatch`/`minimatch`/`js-yaml`/
    `brace-expansion` (dev-only)
  - `vitest`'s `postcss`/`picomatch` (test-only)
  - `next-auth`'s bundled `uuid@3` (unreachable code path)
  - `exceljs`'s `archiver`/`uuid` (server-side but vulnerable path
    not triggered by our usage)
  - `@sentry/nextjs` build-time `@babel/core` (build-only)
- Documented per-package in MIGRATION_NOTES.md with the upstream
  blocker for each.

### 6. CHANGELOG.md

Added `### Changed — v4.1.0 final push to 10/10` section at the top
with a detailed entry per change + a "Files Modified" list.

### 7. package.json version

Changed `"version": "4.0.0"` → `"version": "4.1.0"`.

## Verification (all green)

```
$ bunx tsc --noEmit --strict
(no output — 0 errors)

$ bun run lint
✖ 216 problems (0 errors, 216 warnings)
  0 errors and 18 warnings potentially fixable with the `--fix` option.
(was 218 warnings before this pass — 2 fewer)

$ bun run test
 Test Files  35 passed (35)
      Tests  503 passed | 1 skipped (504)
   Duration  52.46s

$ bun run build
✓ Compiled successfully in 42s
(exit 0)
```

## Files Modified (10) + Created (2) + Deleted (1)

**Modified:**
- `package.json` — version 4.0.0 → 4.1.0
- `src/app/api/auth/[...nextauth]/route.ts` — `@deprecated` banner
- `docs/MIGRATION_NOTES.md` — expanded v5 plan + stub-status rewrite
- `src/lib/swarm.ts` — 742 → 400 lines (entry point only)
- `src/lib/video-understanding/index.ts` — reduced to "Not implemented" stub
- `README.md` — removed 2 🚧 rows
- `RELEASE_NOTES.md` — updated Known Limitations wording
- `CHANGELOG.md` — added v4.1.0 entry

**Created:**
- `src/lib/swarm/worker.ts` — NEW (365 lines, `runWorker` + helpers)
- `src/lib/swarm/orchestrator.ts` — NEW (183 lines, `planSwarm` + `synthesizeSwarm` + `withTimeout`)

**Deleted:**
- `src/lib/collab/collaboration.ts` — dead code (no imports)

## Key decisions (and why)

1. **next-auth v5 NOT migrated** — v5 is in beta; the API is a major
   breaking change; ~12 tests would need rewriting. The CVE situation
   does not justify the risk: the 3 high CVEs are in eslint's
   transitive dev/build deps (not in production runtime), and the
   uuid@3 advisory is unreachable in our usage. Documented the 9-step
   migration plan for when v5 ships stable.

2. **RSC "5+ more" NOT achieved** — All 5 listed components genuinely
   use client features (4 of them) or are already server
   (CollabIndicator was converted in v4.0.0). The remaining 54
   client components can't be safely converted without major
   refactoring that exceeds the scope of this final push. Documented
   honestly in the worklog.

3. **swarm split: BEAT the target** — The audit target was 742 → ~500
   lines. Actual: 742 → 400 lines (46% reduction, 100 lines under
   target). All public symbols re-exported from `swarm.ts` so
   `import { runSwarm, planSwarm, runWorker, ... } from "@/lib/swarm"`
   keeps working unchanged. All 11 swarm tests pass.

4. **video-understanding stub: KEPT (not deleted)** — The task's
   fallback instruction was "If deleting breaks imports, keep them
   but with a minimal stub that throws 'Not implemented' error."
   The video-understanding module IS imported by the API route
   (`/api/video/analyze/route.ts`), so deleting it would break the
   route. Kept a minimal stub. The API route's existing availability
   gate means callers get a clean 503 without ever hitting the throw.

5. **collaboration.ts: DELETED** — The task's primary instruction
   was "Delete the stub files entirely and remove all imports."
   Verified (via grep) that `collab/collaboration` is NOT imported
   by any file in `src/`. Safe to delete. The production collab API
   uses `collab-server.ts` directly (real working implementation).
