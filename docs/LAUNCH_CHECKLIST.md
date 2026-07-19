# Pre-Launch Checklist — Quaesitor v4.0.0

> Verify every box is checked before tagging `v4.0.0` and pushing the
> release. Items marked **BLOCKER** must be ✅ or the launch is held.
> Items marked **SHOULD** are strongly recommended; items marked **NICE**
> are polish. Update this file as the launch progresses — the commit
> that checks the last BLOCKER is the launch commit.

**Last updated:** 2026-07-19
**Launch target:** v4.0.0 public release

---

## Code Quality

- [ ] **BLOCKER** — `bunx tsc --noEmit --strict` passes with 0 errors
- [ ] **BLOCKER** — `bun run lint` passes with 0 errors AND 0 warnings
- [ ] **BLOCKER** — `bun run test` passes with 451+ tests (no regressions)
- [ ] **BLOCKER** — `bun run build` succeeds (production build, not just dev)
- [ ] **SHOULD** — `bun run e2e` passes all 8 E2E specs (Playwright)
- [ ] **SHOULD** — `bun run eval` reports ≥ 7/20 verified passes (baseline in `EVAL.md`)

## Documentation

- [ ] **BLOCKER** — `EVAL.md` has baseline numbers (factual 5/5, coding 2/2 verified)
- [ ] **BLOCKER** — `.env.example` has all required vars (NVIDIA_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OLLAMA_URL, DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, AUTH_USERNAME, AUTH_PASSWORD, AUTH_DEV_BYPASS, MFA_REQUIRED, MFA_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CREDENTIALS_ENCRYPTION_KEY, MAX_DOCUMENT_SIZE_MB, SEARCH_DEPTH, MAX_JOBS, NEXT_PUBLIC_LLM_PROVIDER)
- [ ] **BLOCKER** — `SECURITY.md` is up to date (responsible disclosure, PGP key, scope)
- [ ] **BLOCKER** — `legal/` has all 12 documents (ToS, Privacy, DPA, SLA, Cookie, AUP, CLA, ROPA, IR Plan, SOC2 Readiness, SOC2 Type II Audit Prep, SOC2 Type II Audit)
- [ ] **BLOCKER** — `README.md` has a Quick Start section at the top (3 commands)
- [ ] **BLOCKER** — `RELEASE_NOTES.md` is complete (v4.0.0 announcement)
- [ ] **BLOCKER** — `CHANGELOG.md` is updated with the v4.0.0 entry
- [ ] **SHOULD** — `docs/api/openapi.yaml` covers critical routes (chat, research, sessions, memories, documents, billing, auth, consent, account)
- [ ] **SHOULD** — `docs/LAUNCH_CHECKLIST.md` (this file) is up to date
- [ ] **SHOULD** — `docs/MOBILE.md` (mobile app docs) is up to date
- [ ] **SHOULD** — `docs/ENVIRONMENTAL.md` (carbon footprint methodology) is up to date
- [ ] **SHOULD** — `docs/adr/` ADRs are reviewed and reflect current architecture
- [ ] **NICE** — `CONTRIBUTING.md` mentions the v4.0.0 launch and any new contribution workflows

## Build & Deploy

- [ ] **BLOCKER** — `Dockerfile` builds successfully (`docker build -t quaesitor .`)
- [ ] **BLOCKER** — `docker-compose.yml` brings up the full stack (`docker compose up -d`)
- [ ] **BLOCKER** — CI passes on GitHub Actions (lint + tsc + test + build)
- [ ] **BLOCKER** — Branch protection is enabled on `main` (no force-push, PR review required, CI gates)
- [ ] **BLOCKER** — `npm install` works without `--legacy-peer-deps` (no peer-dep conflicts)
- [ ] **SHOULD** — `setup.sh` works on a fresh clone (creates `.env`, runs `bun install`, prompts for `NVIDIA_API_KEY`)
- [ ] **SHOULD** — Production image is < 1.5GB (multi-stage build, no dev deps in runtime layer)
- [ ] **SHOULD** — Health check (`/api/health`) returns 200 on the production deploy
- [ ] **NICE** — Multi-arch Docker image (linux/amd64 + linux/arm64) for Apple Silicon

## Legal & Licensing

- [ ] **BLOCKER** — `LICENSE` is AGPL-3.0 (full text, unmodified)
- [ ] **BLOCKER** — `COMMERCIAL_LICENSE.md` is present and references the AGPL-3.0 + commercial dual-license model
- [ ] **BLOCKER** — `legal/CLA.md` is present (Contributor License Agreement)
- [ ] **BLOCKER** — `legal/TERMS_OF_SERVICE.md` mentions v4.0.0 effective date
- [ ] **BLOCKER** — `legal/PRIVACY_POLICY.md` lists all current sub-processors (NVIDIA, OpenAI, Anthropic, Stripe, Resend, Sentry)
- [ ] **SHOULD** — `legal/SOC2_TYPE_II_AUDIT.md` reflects the current control set (no stale references)
- [ ] **SHOULD** — `legal/SOC2_READINESS.md` gap analysis is current (gaps from the latest security audit are listed)
- [ ] **NICE** — `legal/ROPA.md` (Record of Processing Activities) is updated with the v4.0.0 feature set

## Security

- [ ] **BLOCKER** — `NEXTAUTH_SECRET` is NOT hardcoded (production throws if missing — verified by `agent-ctx/fix-5-critical-pdf.md`)
- [ ] **BLOCKER** — `AUTH_DEV_BYPASS=1` is NOT set in any production env file
- [ ] **BLOCKER** — `.gitignore` excludes `.env`, `.env.local`, `.env.production`, `*.db`, `*.db-journal`, `node_modules/`, `.next/`, `coverage/`
- [ ] **BLOCKER** — No secrets in git history (`git log -p | grep -iE "(api_key|secret|password|token)" | head` returns nothing sensitive)
- [ ] **BLOCKER** — `bun audit` reports 0 HIGH/CRITICAL vulnerabilities in production deps (dev-only advisories are acceptable, documented in `RELEASE_NOTES.md`)
- [ ] **SHOULD** — `SECURITY.md` has a valid PGP key for responsible disclosure
- [ ] **SHOULD** — CSP, HSTS, X-Frame-Options, Permissions-Policy headers are set in `next.config.ts`
- [ ] **SHOULD** — Rate limiting is configured (Redis in prod, in-memory in dev)
- [ ] **NICE** — `scripts/load-test.sh` baseline is recorded (requests/sec the prod deployment can sustain)

## Release Mechanics

- [ ] **BLOCKER** — `CHANGELOG.md` has a `## [4.0.0] — <date>` entry with all changes since v3.x
- [ ] **BLOCKER** — `package.json` `version` field is `"4.0.0"`
- [ ] **BLOCKER** — Git tag `v4.0.0` is created (annotated, signed if possible)
- [ ] **BLOCKER** — GitHub Release is created (title: "Quaesitor v4.0.0 — Public Launch", body: link to `RELEASE_NOTES.md`)
- [ ] **SHOULD** — Docker image `ghcr.io/abd123454/quaesitor:4.0.0` is pushed
- [ ] **SHOULD** — Docker image `ghcr.io/abd123454/quaesitor:latest` is updated to point at `4.0.0`
- [ ] **SHOULD** — GitHub Discussions "Launch announcement" post is pinned
- [ ] **NICE** — Twitter/Mastodon/LinkedIn launch posts are drafted (link to GitHub Release)

## Post-Launch Verification

Run these within 1 hour of the launch commit going live:

- [ ] **BLOCKER** — Production deployment is reachable (`curl https://<prod-domain>/api/health` returns 200)
- [ ] **BLOCKER** — A real chat message gets a streaming response (manual smoke test)
- [ ] **BLOCKER** — A real deep research job completes within 15 min (manual smoke test)
- [ ] **BLOCKER** — Sentry reports no new errors (compare 24h before vs 1h after)
- [ ] **SHOULD** — `/api/metrics` shows expected request volume
- [ ] **SHOULD** — Rate limiter is enforcing the configured caps (test with a burst)
- [ ] **SHOULD** — Audit logs are being written (`SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour'`)
- [ ] **NICE** — First user-reported issue (if any) is triaged within 24h

---

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Release Engineer | | | |
| Security Lead | | | |
| Operations Lead | | | |

All BLOCKER items must be ✅ before sign-off. SHOULD items should be ✅
or have an explicit deferral filed as a GitHub Issue with a target
date. NICE items are at the release engineer's discretion.

Once all three sign-offs are recorded, push the `v4.0.0` tag, publish
the GitHub Release, and update `docs/LAUNCH_CHECKLIST.md` with the
final "launched at <timestamp>" line.
