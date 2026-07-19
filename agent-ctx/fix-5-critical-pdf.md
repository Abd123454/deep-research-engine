# Task fix-5-critical-pdf — Agent Work Record

**Agent:** fix-5-critical-pdf
**Task ID:** fix-5-critical-pdf
**Date:** 2026-07-18
**Scope:** 5 CRITICAL vulnerabilities (CVSS 8.1–9.8) from the PDF audit report.
**Status:** ✅ Complete

## Mission

Fix 5 critical security vulnerabilities flagged in the PDF audit report:

- **C-1 (CVSS 9.8)** — `NEXTAUTH_SECRET` hardcoded default → JWT forgery
- **C-2 (CVSS 9.1)** — `verify` / `reset-password` accept any token
- **C-3 (CVSS 8.6)** — `/api/chat/agent` uses `DEFAULT_USER_ID = "default"`
- **C-4 (CVSS 8.2)** — `isAuthOptional()` auto-bypasses in non-production
- **C-5 (CVSS 8.1)** — XSS via `wrapReact()` in `ArtifactsPanel`

The full summary, file-by-file changes, verification output, and notes for
downstream agents are in `worklog.md` (this task's section starts with `---`).

## Verification

```
$ bunx tsc --noEmit --strict   → 0 errors
$ bun run lint                  → 0 errors, 0 warnings
$ bun run test                  → 451 passed, 1 skipped (33 files)
```

No regressions — the existing 451 tests all still pass; the 1 skipped test is pre-existing.

## Files Touched

### Created
- `src/lib/verification-tokens.ts` — shared module for single-use email-verification / password-reset tokens

### Modified
- `src/app/api/auth/[...nextauth]/route.ts` — C-1 (fail-closed NEXTAUTH_SECRET)
- `src/app/api/auth/verify/route.ts` — C-2 (real token validate + generate paths)
- `src/app/api/auth/reset-password/route.ts` — C-2 (consume token + hash + update)
- `src/app/api/auth/forgot-password/route.ts` — C-2 (store real reset token)
- `src/app/api/chat/agent/route.ts` — C-3 (use getUserId(req))
- `src/lib/auth.ts` — C-4 (explicit AUTH_DEV_BYPASS flag)
- `src/components/artifacts/ArtifactsPanel.tsx` — C-5 (DOMPurify on HTML + Mermaid, script-tag stripping + try/catch on React)

## Key implementation details (TL;DR)

1. **C-1** throws at module load (NOT inside a function) so the NextAuth route crashes on startup if `NEXTAUTH_SECRET` is missing in production. Dev still falls back to `"dev-only-not-for-production"`.
2. **C-2** uses a `verification_tokens` table with 256-bit random hex tokens, 24h TTL for email verification / 1h for password reset, single-use (atomic consume via `UPDATE … RETURNING` on Postgres, `db.transaction()` on SQLite).
3. **C-3** is a one-line fix: `const userId = getUserId(req)` — preserves the `"default"` fallback when auth isn't configured, so existing tests don't break.
4. **C-4** is a one-line body replacement: `return process.env.AUTH_DEV_BYPASS === "1"` — preview deploys are now fail-closed unless the operator explicitly sets the flag.
5. **C-5** adds three new `useMemo` sanitizers (`sanitizedHtml`, `sanitizedReactSrc`, plus existing `sanitizedSvg`) and rewrites `wrapReact()` to wrap the render call in try/catch + a global error listener. The `MermaidRenderer` now sanitizes its rendered SVG via DOMPurify.

## Notes for downstream agents

See `worklog.md` for the full notes — particularly:
- `AUTH_DEV_BYPASS=1` is now required to bypass auth (previously implicit in non-production)
- `email_verified` column is added lazily but NOTHING enforces it yet — a future agent can add the gate in `requireAuth` or per-route
- The `verification_tokens` table is created lazily; consider wiring `pruneVerificationTokens()` into a background worker if it grows
- `devToken` is returned in dev mode (RESEND_API_KEY unset) for verify-email and forgot-password flows — useful for E2E tests
