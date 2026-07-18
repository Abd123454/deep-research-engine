# Task p0-hardening — 4 P0 Hardening Fixes

**Agent:** p0-hardening
**Date:** 2026-07-16
**Outcome:** SUCCESS — All 4 P0 fixes landed. `tsc` 0 errors, `lint` 0 errors / 0 warnings, `test` 451 passed / 1 skipped (unchanged from baseline).

## Context

Previous work (see `agent-ctx/fix-5-vulns.md`, `agent-ctx/security-hardening.md`, `agent-ctx/p0-compliance.md`) closed many of the audit's critical findings. This task targets four remaining P0 items that the prior passes had flagged but not patched:

1. **P0-5** — `decryptSafe` returns plaintext in production (encryption-at-rest is effectively optional)
2. **P0-8** — Docker sandbox container naming can collide; missing `--init`, swap-limit, and ulimit hardening
3. **P0-10** — Error messages from downstream libraries (LLM provider, Stripe, Postgres) leak secrets to clients / logs
4. **P0-3** — Swarm has no per-user isolation (no userId threading, no plan-limit gate, no cancellation propagation)

## What I changed

### P0-5 — `decryptSafe` refuses plaintext in production

**File:** `src/lib/credentials.ts`

`decryptSafe` previously returned plaintext payloads as-is in ALL environments for backward compatibility. In production, that meant a DB row containing legacy plaintext credentials (written before encryption-at-rest shipped) would keep being returned as plaintext indefinitely — encryption-at-rest became "encryption at rest, *if* you remembered to re-save the row." Now:

- In `NODE_ENV === "production"`: if the payload does NOT match the `ENCRYPTED_PREFIX_REGEX` (`^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$`), the function logs an error and returns `null`. The next save will re-encrypt, so the impact is one missed read.
- In dev/test: keeps the legacy plaintext fallback so existing test fixtures and local dev DBs continue to work.
- In production, if the payload LOOKS encrypted but fails to decrypt (tampered ciphertext, wrong key), it also returns `null` instead of the raw payload (defense-in-depth against an attacker who can write to the DB).

Imports `logger` from `./logger` for the production-side error logging.

### P0-8 — Docker container collision prevention + extra hardening

**File:** `src/lib/code-sandbox-docker.ts`

The `--name sandbox-${sessionId}` flag collided when a stale container from a previous crashed run hadn't been reaped (e.g. host OOM-killed docker between the container exit and the `--rm` reaper). The collision caused `docker run` to fail with "name already in use", which the sandbox surfaced as a Docker-unavailable error.

Fixes:
1. Container name is now `quaesitor-sandbox-${sessionId}-${crypto.randomBytes(4).toString("hex")}` — the random 4-byte (8-hex-char) suffix makes collisions effectively impossible.
2. `docker rm -f ${containerName}` is run BEFORE `docker run` to clean up any stale container with the same name. Wrapped in try/catch — idempotent, ignores "no such container" errors.
3. Added `--init` flag — runs tini as PID 1 inside the container so zombie children are reaped.
4. Added `--memory-swap=${MEMORY_LIMIT}` (= `256m`) — disables swap for the container; without this, the kernel could page the container's anonymous memory to the host's swap partition and a memory-hogging sandbox would exhaust the host instead of being OOM-killed.
5. Added `--ulimit nofile=64:64` — caps open file descriptors per process at 64 (default on Linux is 1048576 — an fd-exhausting sandbox could otherwise exhaust the host's file table).
6. Added `--ulimit nproc=64:64` — caps processes per UID at 64 (defense-in-depth on top of `--pids-limit=64`).

`crypto` was already imported as `* as crypto from "crypto"` so no new import was needed.

### P0-10 — `sanitizeError` strips secrets from error messages

**New file:** `src/lib/sanitize-error.ts`

Exports `sanitizeError(err: unknown): string` that:
- Extracts the message from `Error`, string, or JSON-stringifiable objects (handles `{ message: "..." }` thrown by some libraries).
- Replaces 10 known secret patterns with `[REDACTED]`:
  - HTTP Bearer tokens, Authorization headers
  - OpenAI (`sk-…`), NVIDIA (`nvapi-…`), Anthropic (`sk-ant-…`) API keys
  - Postgres / MongoDB / Redis connection strings with embedded credentials
  - `API_KEY=…`, `password=…` env-var-style leaks
- Truncates to 500 characters as defense-in-depth against log injection (a multi-line error could otherwise mimic a legitimate log entry).

**Applied to 6 critical routes** (the task asked for "at least 5" — chat, research, swarm, billing, connectors):

| Route | Pattern replaced | Where the message goes |
|-------|------------------|------------------------|
| `src/app/api/chat/route.ts` | `err instanceof Error ? err.message : String(err)` | SSE event `{ error: msg }` to client |
| `src/app/api/chat/agent/route.ts` | same | SSE event `{ error: msg }` to client |
| `src/app/api/swarm/route.ts` | same | SSE event `{ type: "error", message: msg }` to client |
| `src/app/api/research/start/route.ts` | 3 occurrences | `logger.error({ err: … })` server-side logs |
| `src/app/api/billing/webhook/route.ts` | 3 occurrences | `logger.error` / `logger.warn` server-side logs |
| `src/app/api/connectors/route.ts` | 3 catch blocks (added `logger.warn` calls; previously only `Sentry.captureException`) | New `logger.warn({ err: sanitizeError(err) })` server-side logs |

The client-facing replacements (chat, swarm) are the most important — those errors crossed the wire to the browser. The server-side log replacements (research, billing, connectors) are defense-in-depth: log aggregators often have weaker access controls than the application database, and an attacker who can read the logs should not be able to extract API keys from a failed LLM call's error message.

### P0-3 — Swarm per-user isolation + plan limits

**Files:** `src/lib/swarm.ts`, `src/app/api/swarm/route.ts`

`runSwarm(task, emit)` previously had no notion of *who* invoked it. Memory recall (if added later) would have run in a global namespace, the audit log couldn't attribute the swarm to a user, and there was no way to gate access behind the plan-limits layer.

Changes to `runSwarm`:
- New optional 3rd parameter: `opts?: { userId?: string; signal?: AbortSignal }`. Both fields optional for backward compat — the existing test suite (`runSwarm("task", (e) => …)`) and the eval runner still work unchanged.
- The `userId` is captured in the closure and logged via `logger.debug` so swarm invocations are attributable in the audit trail. (Currently no swarm worker calls `recallRelevantMemories` directly — if/when one is added, the `userId` is already plumbed through and ready to be passed down.)
- The `signal` is checked via an `assertNotCancelled(phase)` helper before each phase (plan / workers / synthesis) and once per worker before it starts. When the caller aborts (e.g. the user closed the SSE tab), workers that haven't started yet are skipped with a "cancelled" `agent_done` event, and the next phase-check throws a "Swarm cancelled" error that the API route surfaces as an SSE error event. The signal is NOT yet forwarded into `llm.smart()` calls — the `LLMCompletionOptions` interface doesn't currently accept a `signal` field — but the plumbing is in place so a future LLM-provider change can wire it up without touching the swarm layer again.

Changes to `POST /api/swarm`:
- After `getUserId(req)`, calls `checkPlanLimit(userId, "swarm")`. The "swarm" resource is currently a structural cap (max agents per plan, returned as `allowed: true` for all plans) — but the gate is now wired up so a future change to meter swarm usage per-month can be enforced by editing `plan-limits-data.ts` without touching the route.
- If `!planCheck.allowed`, returns `402 Payment Required` with the exact error message from the task spec: `"Swarm limit reached. Upgrade at /pricing for more concurrent agents."`.
- Passes `{ userId, signal: abortController.signal }` to `runSwarm`. The `abortController` was already being instantiated for the SSE stream's `cancel()` handler — the same signal now also propagates into the swarm.
- The catch-block error message is sanitized via `sanitizeError(err)` (P0-10) before being emitted to the client.

## Test results

| Check                       | Before  | After  |
|-----------------------------|---------|--------|
| `bunx tsc --noEmit --strict`| 0       | **0**  |
| `bun run lint`              | 0 / 0   | **0 / 0** (0 errors, 0 warnings) |
| `bun run test`              | 451 / 1 skipped | **451 / 1 skipped** |

No tests added or modified — the existing `swarm.test.ts` calls `runSwarm("task", (e) => …)` with 2 args, which still works because `opts` is optional. The 6 route-level changes are covered by the existing route tests (none of which assert on the specific error message format).

One transient lint warning appeared during development (regex `\/` escapes in `sanitize-error.ts`) — fixed by removing the unnecessary escapes inside character classes (`[A-Za-z0-9\-._~+/]` is equivalent to `[A-Za-z0-9\-._~+\/]`).

## Notes for downstream agents

- **`sanitizeError(err)` is now the canonical helper** for converting any thrown value into a client-safe or log-safe string. Any new API route that catches and surfaces an error message should use it instead of `err instanceof Error ? err.message : String(err)`. The pattern is to import from `@/lib/sanitize-error`. Existing routes that still use the old pattern (`/api/account/route.ts`, `/api/account/export/route.ts`, `/api/memory/export/route.ts`, `/api/preferences/route.ts`, `/api/feedback/route.ts`, `/api/modes/quick/route.ts`, `/api/documents/[id]/qa/route.ts`, `/api/auth/*`) should be migrated opportunistically — they were not touched here because the task scoped the work to the 5 most critical routes.
- **`decryptSafe` now fail-closes on plaintext in production.** Operators deploying to production for the first time after this change should verify that all stored credentials are in the `iv:tag:enc` format. The easiest way is to call `GET /api/connectors` for every project — any connector whose stored credentials are plaintext will show `hasCredentials: false` (because `decryptCredentials` returns null when `decryptSafe` returns null). Re-saving the connector via `POST /api/connectors` will encrypt it. The dev environment is unaffected (plaintext fallback still works there).
- **Docker container names are now non-deterministic.** Any tooling that expects a specific container name pattern (e.g. `docker logs sandbox-abc12345`) must be updated to look for `quaesitor-sandbox-<sessionId>-<8hex>` instead. The `--name` flag is still set, so `docker ps --filter "name=quaesitor-sandbox-"` continues to work for listing active sandboxes.
- **Swarm `opts` is optional.** Existing callers (eval runner, tests) continue to work without modification. New callers that want per-user isolation / cancellation should pass `{ userId, signal }`. The signal currently only checks between phases — it does NOT abort in-flight LLM calls (the LLM provider doesn't yet accept a signal). Adding signal support to `LLMCompletionOptions` would let the swarm cancel mid-LLM-call, but that's a larger change that touches every provider implementation (nvidia, openai, anthropic, ollama) and is out of scope for this task.
- **The swarm plan-limit gate currently always passes** (`checkLimit(userId, "swarm")` returns `allowed: true` for all plans because "swarm" is a structural cap, not a metered resource). The gate is wired up so that changing `plan-limits-data.ts` to add a `monthlySwarms` counter (and updating `checkLimit` to read it) will start enforcing the limit without further route changes.
