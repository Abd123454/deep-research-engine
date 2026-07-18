# Task fix-5-vulns — Fix 5 Critical Vulnerabilities

**Agent:** fix-5-vulns
**Date:** 2026-07-16
**Outcome:** SUCCESS — All 5 vulnerabilities fixed. `tsc` 0 errors, `lint` 0 errors / 0 warnings, `test` 451 passed / 1 skipped (up from 446).

## Scope

5 critical vulnerabilities flagged by `agent-ctx/deep-security-audit.md`:

- **V1** — `GET /api/connectors` returned plaintext decrypted GitHub tokens in the JSON response.
- **V2** — `code-sandbox.ts` had a `vm` (V8 isolate) "fallback" execution path that is not a security boundary (per Node.js docs) but was kept enabled when Docker was unavailable.
- **V3** — `/api/chat` (and the agent route, memory worker, extract route) read memory-extraction consent from `user_preferences.memory_consent` — a plain integer column with no audit trail — instead of the GDPR-Art.7-compliant `consent_ledger` table.
- **V4** — The `customer.subscription.updated` Stripe webhook handler updated only the `status` column, not `plan` — so plan upgrades/downgrades made via the Stripe portal didn't propagate to the DB until the next checkout, causing `plan-limits` enforcement to use the wrong tier.
- **V5** — `GET /api/connectors?projectId=X` did not verify that the caller owns project X — any authenticated user could enumerate someone else's project IDs and read their connector metadata.

## Files changed

- `src/lib/credentials.ts` — added `maskCredentials(creds: Record<string, string>): Record<string, string>`.
- `src/app/api/connectors/route.ts` — `toResponseConnector()` now masks before returning; added `hasCredentials` boolean; added `verifyProjectOwnership()` helper applied to GET and POST; SQLite connector query JOINs on `projects.user_id` as defense-in-depth; Prisma query scopes via `where: { projectId, project: { userId } }`.
- `src/lib/code-sandbox.ts` — removed `runJavaScript`, `runJavaScriptAsync`, `runPython`, `formatArg`, the `vm` import, and all `vm`-based execution. `runCode` dispatcher is now: disabled → Docker-required → Docker. No fallback.
- `src/lib/code-sandbox-docker.ts` — `runCodeSmart` updated to mirror the new policy (no vm fallback delegation).
- `src/lib/memory-extractor.ts` — `isMemoryExtractionEnabled` is now async and delegates to `isConsentGranted(userId, "memoryExtraction")` from `consent.ts`. `isMemoryExtractionEnabledAsync` kept as a deprecated alias. `setMemoryExtractionConsent` still writes the legacy column as a denormalized cache.
- `src/app/api/chat/route.ts` — `await isMemoryExtractionEnabled(userId)`.
- `src/app/api/chat/agent/route.ts` — `await isMemoryExtractionEnabled(userId)`.
- `src/workers/memory-worker.ts` — `await isMemoryExtractionEnabled(userId)`.
- `src/app/api/billing/webhook/route.ts` — `customer.subscription.updated` now retrieves the full subscription from Stripe, reads `items.data[0].price.lookup_key`, validates against `free | pro | team | enterprise`, and updates both `status` and `plan` in one query. Falls back to status-only update if Stripe is unreachable / lookup_key missing.
- `src/lib/__tests__/code-sandbox.test.ts` — rewritten from 14 vm-execution tests to 19 dispatcher-policy tests (disabled state, Docker-required state, Docker delegation, language normalization, exit-code surfacing, output truncation, etc.).
- `src/lib/__tests__/agent-tools.test.ts` — `runCode` is now mocked via `vi.hoisted()` (so the mock is visible to the hoisted `vi.mock` factory). Added a test asserting that Docker-required failures from `runCode` are surfaced in the tool result so the LLM can react.
- `src/lib/__tests__/react-agent.test.ts` — `runCode` mocked via `vi.hoisted()` with a deterministic language-aware stub.
- `src/lib/__tests__/verifier-loop.test.ts` — mock simplified: removed `runJavaScript` / `runPython` stubs (those exports no longer exist).

## Verification

```
bunx tsc --noEmit --strict   → 0 errors
bun run lint                  → 0 errors, 0 warnings
bun run test                  → 451 passed, 1 skipped (33 files)
```

Test count went from 446 → 451 (added 9 new code-sandbox dispatcher-policy tests, removed 5 vm-execution tests that no longer apply, added 1 new agent-tools test for V2 Docker-error surfacing).

## Notes for downstream agents

- **`maskCredentials`** is the canonical helper for safely returning decrypted credentials over the API. `/api/projects/[id]` GET still calls `decryptCredentials` directly — should be updated to use `maskCredentials` for consistency (the `/api/account/export` route intentionally returns plaintext because the user is downloading their own data).
- **Docker is the ONLY code execution backend.** Any new code that needs to run user-supplied JS/TS/Python MUST go through `runCode(language, code)` from `src/lib/code-sandbox.ts` — never through `vm` directly. The previously-deprecated `runJavaScript`, `runJavaScriptAsync`, and `runPython` exports no longer exist; any imports of them will fail at compile time.
- **`isMemoryExtractionEnabled` is now async.** All callers must `await` it. New code that needs the memory-consent gate should call `await isMemoryExtractionEnabled(userId)` — not the legacy `user_preferences.memory_consent` column.
- **The consent ledger** (`consent_ledger` table, see `src/lib/consent.ts`) is the canonical source of truth for ALL consent state — `termsOfService`, `privacyPolicy`, `memoryExtraction`, `marketing`, `ageConfirmation`. Any new "did the user consent to X?" check should use `isConsentGranted(userId, key)`.
- **Stripe `lookup_key`** is the source of truth for plan tier. When creating products in Stripe, set the price's `lookup_key` to one of `free` | `pro` | `team` | `enterprise` (matches `src/lib/plan-limits-data.ts`). The webhook now reads this on every `subscription.updated` event, so plan changes made in the Stripe portal propagate to our DB within one webhook delivery.
- **Project ownership** is enforced at TWO layers in `/api/connectors`: (1) `verifyProjectOwnership()` returns 404 if the caller doesn't own the project, (2) the SQL query JOINs on `projects.user_id` as defense-in-depth. The same pattern should be applied to `/api/projects/[id]` (PATCH/DELETE) — currently those routes don't verify ownership before mutating.
