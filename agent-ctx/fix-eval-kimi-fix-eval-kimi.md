# Work Record — Task fix-eval-kimi

**Task ID:** fix-eval-kimi
**Agent:** fix-eval-kimi
**Status:** ✅ Complete
**Date:** 2025-07-18

## Mission
Fix 3 coding-eval failures (c2: console.assert, c4: isPalindrome not
defined, c5: timeout), add 429 rate-limit spacing for the research
eval pipeline, and apply Kimi's top-3 P0 patterns to `src/lib/swarm.ts`.

## Files Modified

1. **`src/lib/eval/dataset.ts`** — Replaced `console.assert(...)` with a
   throwing `assert(cond, msg)` helper in c2 (binarySearch) and c4
   (isPalindrome) test strings. Bun's `console.assert` doesn't throw,
   so failures were silent. Added inline comments explaining why.

2. **`src/lib/eval/runner.ts`** — Rewrote `extractCode()`:
   - Scan ALL fenced code blocks (not just the first) and return the
     LONGEST (the actual solution, not a tiny example).
   - Accept `py`/`ts` aliases for fence language.
   - Fallback uses `\b(function |def |const |let |var |class |async function )`
     (search anywhere, not just line start).
   Added rate-limit spacing:
   - 2s `setTimeout` before each research query.
   - 3-attempt exponential backoff (4s → 8s) for `runResearch()` on 429.
   - 4s backoff for `waitForJobCompletion()` on 429.

3. **`src/lib/swarm.ts`** — Major changes (457 → 727 lines):
   - **Kimi P0-3**: `MAX_TOOL_ITERATIONS` 4 → 15. New
     `LOOP_DETECTION_THRESHOLD = 3` with `callCounts: Map<string, number>`
     tracker. Same `(tool, params)` tuple 3+ times → break with explicit
     "Loop-degeneration detected" message.
   - **Kimi P0-2**: New local `detectToolCalls()` function (NOT exported
     from agent-tools.ts — local to avoid breaking the swarm test mock).
     Scans for ALL ```` ```tool\n{...}\n``` ```` blocks in one assistant
     message. Runs them in parallel via `Promise.all`, capped at
     `MAX_PARALLEL_TOOL_CALLS = 4`. Single-call `detectToolCall` retained
     as fallback for inline `[TOOL: name]` format.
   - **Kimi P0-1**: New exported `createSubagent(name, systemPrompt, role)`
     and `assignTask(agentId, task, emit?)` mirroring Kimi K2.5 Appendix
     E.8's `create_subagent` / `assign_task` tool schemas. Plus
     `getSubagent`, `listSubagents`, `clearSubagents`, and a `Subagent`
     interface. Process-local in-memory registry, backward-compatible
     (runSwarm unchanged).
   - New `hashToolCall(call)` helper for stable (tool, params) hashing.
   - Added `import { logger } from "./logger"` for loop-degeneration
     warnings.

4. **`src/lib/__tests__/verifier-loop.test.ts`** — Renamed test
   "respects MAX_TOOL_ITERATIONS limit" → "breaks the ReAct loop on
   degenerate retry (same tool+args 3+ times)". Assertion changed from
   `toHaveBeenCalledTimes(4)` to `toHaveBeenCalledTimes(3)` to match
   the new loop-detection behavior (3 calls execute, 4th is blocked).

## Verification

```
$ bunx tsc --noEmit --strict
(0 errors)

$ bun run lint
✖ 6 problems (0 errors, 6 warnings)
(all 6 warnings pre-existing in files I did NOT touch)

$ bun run test
Test Files  33 passed (33)
Tests       447 passed (447)
Duration    47.99s
```

## Manual sanity checks (not in test suite)

1. **Assert helper throws in Bun**: Ran c2 test against correct
   `binarySearch` (PASS) and wrong `binarySearchWrong` (correctly threw
   `Error: test 1 should fail`). `console.assert`'s silent failure is
   gone.
2. **extractCode handles 9 cases**: single block, multi-block (longest
   wins), inline decl in prose, python, empty, no-code, ts-when-js-
   requested, c4-style mixed, bare def at start. All 9 PASS.

## Backward Compatibility

- `planSwarm()`, `runSwarm()`, `synthesizeSwarm()`, `runWorker()` —
  signatures unchanged.
- The single-call `detectToolCall` import from `agent-tools.ts` is
  retained as a fallback inside `runWorker()` for the inline
  `[TOOL: name] params: {...}` format.
- The new `createSubagent` / `assignTask` API is purely additive —
  nothing in the existing call graph uses it yet.

## Notes for Future Agents

- The 2s pre-delay in `runEval` for research queries adds ~20s to the
  full eval suite. Intentional — alternative is hitting the 429 wall
  mid-suite.
- `MAX_TOOL_ITERATIONS = 15` is global. kimi-research (worklog lines
  2333–2353) recommends role-specific limits; future task could split
  into `Record<AgentRole, number>` if finer control is needed.
- Loop-degeneration tracker is per-`runWorker()` invocation. Hoist to
  `runSwarm()` level if cross-worker detection is needed.
- `extractCode` returns the LONGEST fenced block (change `>` to `>=`
  at line 95 of runner.ts to prefer the LAST block instead).
- `Subagent` registry is process-local. Move to Redis if cross-process
  sharing is needed (matches existing in-memory design of
  `research-store.ts`).

## Cross-References

- **kimi-research section** in `/home/z/my-project/worklog.md` at lines
  1758–2767 — source of the three P0 patterns applied here.
- **Worklog entry** appended at lines 2768–2970 of worklog.md.
- **Trilogy AI production post-mortem** (cited in kimi-research §6.4)
  — source of the loop-degeneration detection requirement.
- **K2.5 paper Appendix E.8** (arXiv:2602.02276v1) — source of the
  `create_subagent` / `assign_task` JSON schemas mirrored in the new
  `createSubagent` / `assignTask` API.
