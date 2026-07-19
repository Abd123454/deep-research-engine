# Work Record — fix-8-high

**Task ID:** fix-8-high
**Agent:** fix-8-high (single-pass security remediation agent)
**Date:** 2026-07-19
**Scope:** Remediate all 8 HIGH-severity vulnerabilities identified in the
PDF audit, in one pass. Do not break existing tests (tsc + lint + 451+
tests must all pass).

## Summary

All 8 HIGH-severity findings fixed in a single pass. Full worklog entry
appended to `/home/z/my-project/worklog.md` (created fresh — file did
not exist before this run).

## Verification (final)

- `bunx tsc --noEmit --strict` → **0 errors**
- `bun run lint` → **0 errors** (exit 0)
- `bun run test` → **452 passed, 1 skipped** (33 test files)

## Files modified

| # | Vuln ID | CVSS | File(s) |
|---|---------|------|---------|
| 1 | H-1 | 7.5 | `src/lib/safe-fetch.ts` |
| 2 | H-2 | 7.1 | `src/components/artifacts/ArtifactsPanel.tsx` |
| 3 | H-3 | 6.5 | 7 API routes + `src/lib/auth.ts` (`requireAdminAccess`) |
| 4 | H-4 | 6.1 | `src/proxy.ts` (wires `src/lib/csrf.ts`) |
| 5 | H-5 | 6.5 | `src/app/api/billing/webhook/route.ts` |
| 6 | H-6 | 6.0 | `browser-extension/manifest.json`, `background.js`, `content.js` |
| 7 | H-7 | 5.4 | `src/lib/prompt-security.ts`, `src/lib/__tests__/prompt-security.test.ts` |
| 8 | H-8 | 5.0 | `src/lib/mfa.ts`, `src/lib/auth.ts` |

## Notes for downstream agents

- **H-3 bonus:** Found a 7th route (`artifacts/stream/route.ts`) using the
  same vulnerable XFF pattern that the audit didn't list — fixed it for
  consistency. Also fixed `requireAdminAccess` in `auth.ts`, which used
  the same pattern for the admin-IP allowlist (a security decision, not
  just logging).
- **H-4 dev-mode guard:** Added `process.env.AUTH_DEV_BYPASS !== "1"`
  condition to the CSRF check in `proxy.ts` so local dev (no Basic Auth
  configured) isn't blocked before reaching `requireAuth`. Production
  (no `AUTH_DEV_BYPASS`) gets full CSRF enforcement.
- **H-7 test update:** The existing `prompt-security.test.ts` had 5
  tests asserting SQL keywords WERE stripped — those tests were testing
  the bug, not the fix. Updated them to assert the new correct behavior
  (SQL keywords preserved). Added one new test for `--` preservation.
  Net test count unchanged: the test FILE went from 32 → 32 tests
  passing.
- **H-8 backward compat:** `getUserMfaSecret(userId)` falls back to
  `MFA_SECRET` env var when no per-user secret is configured, logging a
  warn so the legacy mode is visible. Existing single-user deployments
  keep working while operators migrate to per-user MFA via
  `/api/auth/mfa/setup`.

## What did NOT change

- `audit.ts:129` — still reads `x-forwarded-for` directly. This is for
  audit-LOGGING the IP of who performed an action, not for any security
  decision. Leaving as-is (low value to change, no security impact).
- `customer.subscription.deleted` handler in `billing/webhook/route.ts`
  still uses `let canceledUserId = "default"` — this is only for the
  audit log when looking up the userId from the DB fails. The H-5 task
  scope was specifically the `checkout.session.completed` handler.
- DNS-rebinding TOCTOU in `safe-fetch.ts` — acknowledged with a comment
  per the task instruction. Full mitigation requires low-level socket
  access (custom `http.Agent` + `lookup` hook) — out of scope for this
  wrapper.
