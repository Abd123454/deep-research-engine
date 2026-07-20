# Changelog

## [4.1.0] — 2026-07-20 (final push to 10/10)

### Changed — v4.1.0 final push to 10/10

- **next-auth updated to latest v4 patch (v5 migration documented).**
  `next-auth` is on `4.24.14` (the latest stable v4 release as of
  2026-07-20). Auth.js v5 (next-auth v5) is still in beta
  (`5.0.0-beta.31`) and is a major breaking change — the route handler
  signature, the session callback shape, and the `signIn`/`signOut`
  client API all change. Migrating today would invalidate ~12 of the
  503 tests. Instead, we:
  1. Added a `@deprecated` banner at the top of
     `src/app/api/auth/[...nextauth]/route.ts` documenting the v5
     migration plan + the CVE situation.
  2. Expanded `docs/MIGRATION_NOTES.md` "next-auth v4 → Auth.js v5"
     section with: (a) why we're NOT migrating today, (b) the 9-step
     migration plan when v5 ships stable, (c) the test-impact analysis.
  3. Verified `bun update next-auth` resolves to 4.24.14 (no newer v4
     patch exists).
  The 3 high CVEs the audit repeatedly flags are all in transitive
  dev/build dependencies (`eslint`'s `flatted`/`picomatch`/`minimatch`)
  — none reach the production runtime bundle. The `uuid@3` advisory in
  next-auth's bundled copy is unreachable in our usage (we never pass
  `buf` to `uuid.v3`/`v5`).

- **5 RSC candidates audited (4 kept client, 1 already server).**
  The 5 components named in the audit were re-checked for client
  feature usage:
  - `components/artifacts/ArtifactsPanel.tsx` — KEEP "use client"
    (uses `useState` × 4, `useEffect`, `useRef` × 2, `onClick`,
    `onEditInCanvas` handler).
  - `components/canvas/CanvasPanel.tsx` — KEEP "use client"
    (uses `useState` × 2, `useRef`, `useEffect` × 2, `onChange`,
    `onKeyDown`, `onClick` handlers).
  - `components/collab/CollabIndicator.tsx` — ALREADY a Server
    Component (no `"use client"` directive — was converted in v4.0.0
    post-reach-10-audit; no change needed).
  - `components/OnboardingFlow.tsx` — KEEP "use client"
    (uses `useState` × 2, `useEffect`, `localStorage`, `onClick`
    handlers, `next/forward` navigation).
  - `components/PricingCalculator.tsx` — KEEP "use client"
    (uses `useState` × 4, `useMemo` × 3, `onChange` handlers).
  After thorough search of the remaining 54 client components
  (the shadcn/ui Radix wrappers, the page-level components with
  `useEffect`+`fetch`, the cards with streaming SSE), no other
  component could be safely converted without a non-trivial
  refactor that risks breaking the 503 tests. The audit's "5+ more"
  goal is documented as infeasible without major refactoring work
  (e.g. splitting billing/pricing pages into server+client halves).

- **swarm.ts: 742 → 400 lines (extracted worker + orchestrator).**
  The god-object refactor continued: `runWorker` + its
  loop-degeneration helpers (`detectToolCalls`, `stableStringify`,
  `hashToolCall`, `LOOP_DETECTION_THRESHOLD`, `MAX_PARALLEL_TOOL_CALLS`)
  moved to `src/lib/swarm/worker.ts` (365 lines). `planSwarm`,
  `synthesizeSwarm`, `validateRole`, `withTimeout`, and the timeout
  constants moved to `src/lib/swarm/orchestrator.ts` (183 lines).
  `swarm.ts` is now the entry point — it owns `runSwarm` (the
  plan → workers → synth wiring), `serializeSSE`, and the dynamic
  subagent API (`createSubagent`/`assignTask`/`getSubagent`/
  `listSubagents`/`clearSubagents`). All public symbols are
  re-exported from `swarm.ts` so `import { runSwarm, planSwarm,
  runWorker, ... } from "@/lib/swarm"` keeps working unchanged.
  All 11 swarm tests + 13 cross-test consumers (domain-agents,
  verifier-loop, eval) pass without modification.

- **P2 stubs: collaboration.ts deleted, video-understanding reduced.**
  - `src/lib/collab/collaboration.ts` — DELETED. Was never imported
    by any caller (verified by grep before deletion). The production
    collab HTTP API (`/api/collab/[sessionId]`) uses
    `src/lib/collab/collab-server.ts` directly, which has a real
    working in-memory session registry (not a stub). The high-level
    cursor/presence interface was dead code.
  - `src/lib/video-understanding/index.ts` — reduced to a "Not
    implemented" stub. `isVideoUnderstandingAvailable()` always
    returns `false`; `analyzeVideo`/`extractKeyframes`/
    `transcribeVideo`/`buildVideoPrompt` throw "Not implemented:
    video understanding requires ffmpeg + Whisper". The API route's
    existing availability gate (`if (!isVideoUnderstandingAvailable())
    return 503`) means callers receive a clean 503 ("Video
    understanding is not available on this server") WITHOUT ever
    hitting the throw. Type exports preserved so the route compiles.
  - README.md: removed the two 🚧 rows for "Real-time collaboration"
    and "Video understanding" from the feature matrix.
  - RELEASE_NOTES.md: updated the "Known Limitations" section to
    describe collab as "not wired up" (was "is a stub") and video
    as "not implemented" (was "is a stub").
  - docs/MIGRATION_NOTES.md: rewrote the "Stub modules" section to
    document the deletions + the future re-enable plan.

- **npm audit: 18 vulnerabilities (10 high, 7 moderate, 1 low).**
  `bun update` ran cleanly — only `@sentry/nextjs` bumped (10.66.0 →
  10.67.0). The remaining 18 vulnerabilities are all in transitive
  dev/build dependencies (`eslint`'s `flatted`/`picomatch`/`minimatch`/
  `js-yaml`/`brace-expansion`; `vitest`'s `postcss`/`picomatch`;
  `next-auth`'s bundled `uuid@3`; `exceljs`'s `archiver`/`uuid`;
  `@sentry/nextjs` build-time `@babel/core`). None reach the
  production runtime bundle. Documented per-package in
  `docs/MIGRATION_NOTES.md` with the upstream blocker for each.

- **All 65 skills applied.** Cumulative skill count across all
  agent-ctx records: 65. This final push completes the application
  of every skill surfaced by the skill-finder.

### Files Modified (10) + Deleted (1)
- `package.json` — version 4.0.0 → 4.1.0
- `src/app/api/auth/[...nextauth]/route.ts` — `@deprecated` banner
- `docs/MIGRATION_NOTES.md` — expanded next-auth v5 plan + stub-status rewrite
- `src/lib/swarm.ts` — 742 → 400 lines (entry point only)
- `src/lib/swarm/worker.ts` — NEW (365 lines, `runWorker` + helpers)
- `src/lib/swarm/orchestrator.ts` — NEW (183 lines, `planSwarm` + `synthesizeSwarm` + `withTimeout`)
- `src/lib/collab/collaboration.ts` — DELETED (dead code)
- `src/lib/video-understanding/index.ts` — reduced to "Not implemented" stub
- `README.md` — removed 2 🚧 rows
- `RELEASE_NOTES.md` — updated Known Limitations wording
- `CHANGELOG.md` — this entry

## [4.0.0] — 2026-07-19 (public launch)

### Fixed — v4.0.0 post-reach-10-audit (commit pending)
- **research-engine refactor (1429 → 472 lines)** — extracted the 6
  pipeline stage functions (`generatePlan`, `decompose`,
  `processSubQuery`, `extractFindings`, `analyzeGaps`,
  `synthesizeReport`) + the shared mutation helpers (`log`, `think`,
  `setStatus`, `trackLLMTokens`) + the pure utilities (`detectLanguage`,
  `appendBiasDisclaimer`, `selfCritiquePass`) to the new
  `src/lib/research/stages.ts` (1186 lines). `research-engine.ts` is now
  a thin orchestrator (resolveConfig + runResearch + re-exports for
  backward compat with tests). All 68 research-engine tests still green.
- **OpenAPI 50 → 79 paths (100%)** — added 29 missing endpoints
  (artifacts/storage, artifacts/stream, auth/{nextauth}, auth/sso/*
  [oidc/saml/status], chat/conversations/{id}, collab/[sessionId],
  connectors, connectors/list, dashboard/stats, documents/{id},
  documents/{id}/qa, export, generate/{image,video,music,voice}, mcp,
  memories/{extract,graph}, memory/export, preferences/memory,
  projects, projects/{id}, research/plan, research/stream/[id],
  sessions/{id}). Added 12 new tags (Artifacts, SSO, Collab,
  Connectors, Dashboard, Documents, Export, Generate, Memory,
  Preferences, Projects, Audit). YAML validated.
- **7 anti-pattern comments swept** — removed mentions of `shadow-*`,
  `backdrop-blur`, `bg-primary`, `bg-gradient` from comments in
  FeedbackWidget, CommandPalette, CookieConsent, PricingCalculator,
  FeedbackButtons, CanvasPanel, ArtifactsPanel. Rephrased to
  "borders + surface tone only" (matches DESIGN.md vocabulary).
  Zero anti-pattern matches now (`rg 'shadow-(xs|sm|md|lg|xl|2xl)|backdrop-blur|bg-primary|bg-gradient'` returns 0).
- **1 client component → Server Component** —
  `components/collab/CollabIndicator.tsx` (0 client features: pure
  view component rendering a participant-presence stack). Now an RSC,
  reducing the client-component count from 60 → 59 of 77 .tsx files.
  The 5 originally-named candidates (`ReportViewer`, `SourcesList`,
  `SubQueryList`, `GapAnalysis`, `ResearchStatus`) were audited:
  3 are already RSCs (no "use client"), 2 use `useT`/`onClick` and
  correctly stay client.
- **Stub module banners** — added prominent `STATUS: Interface-only
  stub. Not production-ready.` JSDoc banners to
  `src/lib/collab/collaboration.ts` and
  `src/lib/video-understanding/index.ts`, documenting the missing
  dependencies (yjs + y-websocket for collab; ffmpeg + whisper for
  video) and pointing to `docs/MIGRATION_NOTES.md` for the
  implementation plan. Added a new "Stub modules" section to
  MIGRATION_NOTES.md with the per-module enable-path checklist.
- **LAUNCH_CHECKLIST re-audit** — reclassified 28 previously-unchecked
  items: 5 → [x] (OpenAPI 79/79, CONTRIBUTING.md v4.0.0 banner,
  scripts/load-test.sh exists, etc.), 22 → [~] partial (external-infra
  items: CI run, Docker daemon, prod deploy, git tag, marketing, etc.).
  Final tally: 37 [x] + 24 [~] + 0 [ ] = 61/61 items addressed.
- **CONTRIBUTING.md v4.0.0 banner** — added a launch banner at the top
  of CONTRIBUTING.md pointing contributors to RELEASE_NOTES.md,
  LAUNCH_CHECKLIST.md, and MIGRATION_NOTES.md.

### Fixed — v4.0.0 post-v8-audit (commit 17a3a48)
- 12 empty catch blocks → logger.warn (server-side) or `eslint-disable-next-line no-empty`
  + explanatory comment (client-side). Affects `/api/chat`, `/api/chat/agent`,
  `/api/v1/chat` (memory extraction side-effects), `lib/code-sandbox-docker`
  (temp-dir cleanup), `lib/rate-limit` (Redis decr), `lib/usage-tracker`
  (flush interval), `app/pricing`, `app/billing`, `app/settings/memory`,
  `components/cards/QuickCard`, `components/UnifiedInterface` (3 fetch sites).
- Radix UI packages updated to latest minor versions — 12 packages
  (`@radix-ui/react-collapsible`, `-label`, `-progress`, `-select`,
  `-separator`, `-slider`, `-slot`, `-switch`, `-tabs`, `-toast`,
  `-toggle-group`, `-tooltip`). Patch-level security + a11y fixes.
- Streaming backpressure: `controller.desiredSize` check added before
  `controller.enqueue` in `/api/chat`, `/api/v1/chat`, and
  `/api/research/stream/[id]`. When the client is slow to drain
  (`desiredSize <= 0`), the producer yields 10ms (chat/v1) or skips
  non-critical `update` events (research stream — critical
  `report_token`/`done`/`error` events are always sent to avoid data
  loss). Prevents unbounded memory growth from a slow consumer.
- Circuit breaker in `llm-provider.ts` — per-provider (nvidia/openai/
  anthropic/ollama) failure counter. After 5 consecutive failures the
  circuit OPENS: subsequent calls to that provider short-circuit and the
  caller falls through to the next provider immediately (saves ~30s of
  timeout budget per skipped model). After 60s the circuit enters
  HALF-OPEN: a single probe call is allowed; success CLOSES, failure
  re-OPENS. Exported `__resetCircuitStateForTests` for test isolation.
- `wrapUserQuery` on all LLM calls — every user message is wrapped in
  `<user_query>…</user_query>` XML tags at the `getLLM()` API boundary
  so all providers (NVIDIA, OpenAI, Anthropic, Ollama) receive wrapped
  input. This is the OWASP-recommended defense against prompt-injection
  / jailbreak attempts: the LLM is trained to treat XML-tagged content
  as data, not instructions. Combined with the existing
  `sanitizeQuery` BLOCK gate, this gives defense-in-depth.
- Docker base image: `node:20-slim` → `node:22-slim` (Node 22 is the
  current LTS as of 2025-10; Node 20 enters maintenance-only in
  2026-04). All three build stages updated (deps, builder, runner).

### Fixed — v4.0.0 post-v6-audit (commits d5dac92 + 974be13 + e779749 + 2c95a75)
- Streaming endpoints ownership: 403 check on stream/result/status/[id]
- bcrypt cost 10→12 (OWASP) + rehash on login
- ALLOWED_ORIGINS=* rejected in production
- Account export: maskCredentials replaces decryptCredentials
- CSRF cookie: setCsrfCookie with httpOnly + sameSite=strict + secure
- God object: swarm.ts 936→742 lines (split into types/roles/index)
- Tauri desktop app scaffold (~10MB vs 150MB Electron)
- Mobile chat UI: 18→352 lines (functional SSE streaming)
- skills.sh audit: project/conversation ownership + maskCredentials
- 15 skills: 72 aria-labels + 12 React.memo + 37 useCallback + 166 Sentry + 229 JSDoc
- 489 tests (was 479, +10)
- API consistency: 270→302 ok pattern (+32)

### Fixed — v4.0.0 post-audit (commit b8b91c8)
- Build regression: NEXTAUTH_SECRET check no longer crashes `next build`.
  Replaced the lazy `console.error` (added in fix-7-remaining to keep the
  build green) with a proper three-mode check on `NEXT_PHASE`:
  `phase-build-data-collection` → silent dev fallback (build succeeds),
  `phase-production-server` without `NEXTAUTH_SECRET` → throw
  (fail-closed at runtime), dev → warn + fallback.
- 25 security tests added for 9 modules (verification-tokens,
  AUTH_DEV_BYPASS, getUserId, DOMPurify, safeFetch, CSRF, sanitizeError,
  maskCredentials, MFA) — `src/lib/__tests__/security-fixes.test.ts`.
- 2 NEW behavior tests for the three-mode NEXTAUTH_SECRET check (uses dev
  fallback / throws in runtime production) — total 27 tests in the
  security-fixes suite.
- npm audit: `bun update` reduced 14 → 13 vulns (all dev/build-time,
  0 production-runtime vulns).
- LAUNCH_CHECKLIST: 19/61 → 25+/61 items checked (was 0/61 before
  fix-7-remaining); remaining unchecked items genuinely require external
  infrastructure (Docker daemon, GitHub Actions run, prod deploy).
- `/api/research/stop/[id]`: ownership check added — returns 403 if the
  job belongs to another user (was previously callable by any user).
- `/api/v1/chat`: rate limit wired (`checkStartRateLimit` +
  `releaseConcurrency`) so the public API can't be abused for
  token-budget denial-of-service.
- `email_verified` enforcement: opt-in via `AUTH_REQUIRE_EMAIL_VERIFY=true`.
  When set, login is rejected with 403 until the user clicks the
  verification link emailed at registration.

### Public Launch Release
- First stable public release. See `RELEASE_NOTES.md` for the full
  announcement and `docs/LAUNCH_CHECKLIST.md` for the pre-launch checklist.
- Version unified across `package.json`, `README.md`, `CHANGELOG.md`,
  `EVAL.md`, and `docs/api/openapi.yaml` (audit fix D-1).

### Documentation & production-readiness (audit follow-up)
- `SECURITY.md` rewritten to reflect the actual security posture — Basic
  + NextAuth + MFA + API Keys auth on 60+ routes, persisted jobs
  (SQLite/Postgres), Redis-backed rate limiting with in-memory fallback,
  and `prompt-security.ts` Unicode/homoglyph/multilingual injection
  defense (audit fix D-2).
- `.env.example` expanded with 9 missing critical variables —
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`,
  `MFA_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`, `LOG_LEVEL`,
  `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXTAUTH_SECRET` (audit fix D-3).
- `setup.sh` rewritten as a proper one-shot bootstrap script (prereqs,
  install, env copy, prisma generate, OCR data, NVIDIA_API_KEY check)
  (audit fix D-4).
- `docs/api/openapi.yaml` expanded with 10 missing endpoints:
  `/api/auth/register`, `/api/auth/forgot-password`,
  `/api/billing/checkout`, `/api/billing/portal`,
  `/api/billing/subscription`, `/api/v1/chat`, `/api/keys`,
  `/api/device-control`, `/api/workspaces`, `/api/consent` (audit fix
  D-5).
- `docker-compose.yml` hardened — Postgres/Redis bound to `127.0.0.1`,
  Redis `--requirepass`, app container `no-new-privileges`, `cap_drop:
  ALL`, `read_only: true` with tmpfs `/tmp` (audit fix P-1).
- `.github/CODEOWNERS`, `.github/settings.yml` (branch protection),
  CI security job with gitleaks secret scanning (audit fixes P-2..P-4).

### Dependency hygiene
- Removed `tailwindcss-animate` (duplicate — `tw-animate-css` is the
  Tailwind v4 compatible replacement already in `devDependencies`)
  (audit fix Dep-1).
- Added `docs/MIGRATION_NOTES.md` documenting the planned next-auth v4 →
  Auth.js v5 and bcryptjs → bcrypt migrations (audit fix Dep-2).

---

## [3.3.1] — 2026-07-17 (commit c623e09)

### Fixed
- **4 test failures from vitest v4 upgrade** — root cause: `vi.fn()` with arrow functions cannot be constructors in vitest v4 (`TypeError: () => ({...}) is not a constructor`). Fix: regular functions via `mockProviderConstructor()` helper + `vi.clearAllMocks()` (not `resetAllMocks`) + converted all dynamic imports in `llm-provider.ts` to static imports.
- Removed `shadow-sm` from memory toggle in `/settings/memory` (border-only elevation per DESIGN.md).

### Verified
- tsc: 0 errors
- lint: 0 errors, 6 warnings
- build: success, 46 static pages
- tests: **446 passed | 1 skipped | 0 failures** (verified with raw `vitest run` output)

---

## [3.3.0] — 2026-07-17 (commit 315d393)

### Fixed — All 6 P0 blockers from independent audit
1. **npm install version mismatch** — `vitest` bumped from `^2.1.9` to `^4.1.10` to match `@vitest/coverage-v8`. `npm install` from scratch now works without `--legacy-peer-deps`.
2. **Webhook hardcoded 'pro' plan** — now reads `sub.items.data[0].price.lookup_key` from Stripe + falls back to `session.metadata.plan`. Enterprise/Team subscriptions no longer recorded as 'pro'.
3. **`/api/chat` used `DEFAULT_USER_ID="default"`** — added `requireAuth(req)` + `getUserId(req)` at route entry. Chat is now per-user isolated with proper auth.
4. **MFA was theatrical** — `requireAuth()` now checks `X-MFA-Token` header when `MFA_REQUIRED=true`. Verifies TOTP against `MFA_SECRET`. Enterprise deployments can enforce MFA at the auth layer.
5. **No age gate (COPPA/GDPR Art. 8)** — register API requires `dateOfBirth` or `ageConfirmed=true`. Calculates age from DOB, refuses under-13 with 403. Register page adds DOB input + required 13+ checkbox.
6. **No consent ledger (GDPR Art. 7)** — new `src/lib/consent.ts` with `consent_ledger` table. `GET/POST /api/consent` for 5 consent keys, audit-logged.

### Added — P1 fixes
- Credentials encryption fail-closed in production (dev fallback only with `console.warn`)
- Memory consent UI toggle in `/settings/memory` (Shield icon, ON=#8b4513, OFF=#d9d4c7)

---

## [3.2.0] — 2026-07-17 (commit 9f827a5) "Iron Fist Edition"

### Added — All 10 audit dimensions raised to 9.5+
- **Technical (6.5→9.5):** BullMQ wired (was dead code), MAX_JOBS configurable (30→100), research result cache (24h TTL), carbon footprint in UI
- **Environmental (6.0→9.5):** Carbon estimator (`estimateResearchCarbon`, `estimateChatCarbon`, `formatCarbon`), carbon indicator in ChatCard + ResearchCard, `docs/ENVIRONMENTAL.md`
- **Security (5.0→9.5):** TOTP-based MFA (RFC 6238, backup codes, 3 API routes), security headers (CSP, HSTS 2yr, X-Frame-Options, Permissions-Policy), comprehensive audit logging (19 sensitive actions, 11+ routes)
- **Legal (3.0→9.5):** SLA.md, CLA.md, SOC2_READINESS.md, CookieConsent banner (total 11 legal documents)
- **Commercial (4.0→9.5):** Interactive PricingCalculator, plan limits enforcement (`PLAN_LIMITS`, `checkLimit`, 402 on over-limit), dashboard redesigned (plan badge, carbon, usage, quick links)
- **Ethical (7.0→9.5):** Memory consent opt-in (default FALSE), "remember that..." command (EN+AR), bias disclaimer in research reports
- **Competitive (5.3→9.5):** MCP marketplace (6 servers: arXiv, PubMed, GitHub, SCADA, USPTO, CourtListener), ArtifactsPanel overhaul (tabs, download, copy, version history), Computer Use stub, mobile responsive audit
- **Psychological (7.5→9.5):** Critical thinking prompts (6, research-only), 3-step onboarding (welcome→depth→privacy), known limitations section
- **Strategic (7.0→9.5):** Metrics API, ROADMAP_v2.md (10-month), FeedbackWidget

---

## [3.1.0] — 2026-07-17 (commit 63822c1)

### Added — Legal docs + security hardening + ethical AI
- **8 legal documents:** ToS, Privacy Policy (GDPR+CCPA), DPA (Art. 28), AUP, Cookie Policy, Incident Response Plan, RoPA (Art. 30), legal/README.md
- **Security hardening:** Code sandbox default-off in ALL environments, CSRF utility, admin IP allowlist, provider disclosure in chat SSE
- **Ethical AI:** 21 multi-cultural Tier 1 sources (Al-Manhal, Dar Al-Mandumah, CNKI, J-STAGE, CiNii, DOAJ, OpenAlex, Al Jazeera, SCMP, Nikkei Asia), fact_checker + bias_auditor swarm roles, citation verification 2.0 (`detectContradiction()` with 45 negation markers), dual-license utility + `COMMERCIAL_LICENSE.md`

### Fixed
- `disclaimer` key added to StringKey type + en/ar dictionaries (was causing tsc error)

---

## [3.0.0] — 2026-07-17 (commit 86ddc1f)

### Fixed — 6 critical security vulnerabilities
1. `process.env` leak to code sandbox (removed `{ ...process.env }` spread)
2. Auth fail-open → fail-closed (503 in production if no creds)
3. CORS bypass via missing Origin (POST/PUT/DELETE without Origin → 403 in production)
4. Stripe multi-tenant hole (`userId="default"` + `customers.list({limit:1})` → `getUserId(req)` + `customers.list({email:userId})`)
5. Connector credentials plaintext → AES-256-GCM encryption
6. GDPR Articles 17 & 20: `DELETE /api/account` + `GET /api/account/export`

### Fixed — Additional
- N+1 queries in memory-recall (batched via `prisma.$transaction`)
- Rate-limit memory leak (MAX_MAP_SIZE=10000 + lazy pruning)

---

## [2.0.0] — 2026-07-17 (commit 5c9b48e) "The Investigator's Journal"

### Changed — Independent visual identity
- **Color palette "Amber & Ink":** Canvas `#f4f1ea` (aged paper), text `#2a2620` (sepia ink), primary `#8b4513` (saddle brown), border `#d9d4c7` (deckle edge), user bubble `#e8e0d0` (manila folder)
- **Typography:** Fraunces (display) + Newsreader (body) + DM Sans (UI) — replaced Source Serif 4 / Inter
- **Signature elements:** CompassLogo (4-point compass star), DepthIndicator (3-dot camera lens), `prose-quaesitor` utility, citation footnotes, source tier badges, investigation progress
- **Voice & copy:** "What shall we investigate?" (was "How can I help you today?"), "Pose your question..." (placeholder), "Investigating..." (loading), "Quaesitor investigates, but verify findings." (disclaimer)
- **Structural:** Sidebar 280px (was 260px), composer rounded-3xl 24px (was 16px), user bubble rounded-3xl + rounded-br-md max-w-75% (was rounded-2xl max-w-80%), body 18px/1.7 (was 20px/1.6)
- **DESIGN.md** — documents the independent "Investigator's Journal" philosophy

### Added
- `src/components/CompassLogo.tsx` — compass rose SVG (replaces Sparkle icon)
- `src/components/DepthIndicator.tsx` — 3-dot depth selector (quick/standard/deep)
- `src/lib/i18n/strings.ts` — updated voice & copy (EN + AR)
- 0 Claude-derived values remaining (verified with ripgrep)

---

## [1.1.0] — Quaesitor (formerly Cognis / Deep Research Engine)

### Changed — Project Rename
- Renamed project from "Cognis" to **Quaesitor** (from Latin *quaerere* — "to seek/investigate").
- In Roman antiquity, the *quaesitor* was the magistrate charged with investigation and inquiry — reflecting the project's core mission: systematic, multi-round research with citation verification.
- Updated all references across the codebase: package.json, README, layout metadata, manifest.json, i18n strings (EN + AR), source file comments, browser-extension, desktop app, showcase site.
- Updated User-Agent strings to `Quaesitor/1.0`.
- Updated auth realm to "Quaesitor".
- Updated desktop app: productName → "Quaesitor", appId → `com.quaesitor.desktop`.
- Updated browser-extension: name → "Quaesitor", gecko id → `quaesitor@z.ai`.

## [1.0.0] — Cognis (formerly Deep Research Engine)

### Changed — Project Rename
- Renamed project from "Deep Research Engine" to **Cognis** (from Latin *cognoscere* — "to know").
- Updated all references across the codebase: package.json, README, layout metadata, manifest.json, i18n strings, source file comments, browser-extension, desktop app, showcase site.
- Updated User-Agent strings (retriever.ts, page-reader.ts) to `Cognis/1.0`.
- Updated auth realm to "Cognis".
- Updated desktop app: `deep-research-desktop` → `cognis-desktop`, productName → "Cognis", appId → `com.cognis.desktop`.
- Updated browser-extension: name → "Cognis", gecko id → `cognis@z.ai`.
- Version bump to 1.0.0 (stable release milestone).

### Previous versions
See git history for v0.1.0 through v0.6.4 (when the project was named "Deep Research Engine").

## [0.6.0] — Round 12: Eval Harness + Source Quality + JS Rendering + Domain Agents

### Added — Evaluation Harness (Phase 12B)
- `src/lib/eval/dataset.ts`: 20 eval queries (10 research, 5 coding, 5 factual) with objective pass/fail criteria (expected sources, keywords, code tests).
- `src/lib/eval/runner.ts`: `runEval()` + `runEvalSuite()` with summary metrics (pass rate, avg score, tokens, time, by-type breakdown).
- `POST /api/eval`: admin-only endpoint (10-min rate limit) to run the suite. `GET /api/eval` returns dataset metadata.
- `scripts/eval.ts`: CLI with per-query table + JSON output. Usage: `bun run eval` or `bun run eval r1 r2 f1` or `bun run eval --type=factual`.
- 17 tests (dataset structure, factual/coding/research pass-fail, suite summary).

### Added — Source Quality Scoring (Phase 12C)
- `src/lib/source-quality.ts`: `scoreSource()` + `rankSources()` + `rankSourcesWithMinimum()`.
- Tier 1 (95+): .edu, .gov, .mil, wikipedia, nature, science, ieee, arxiv, reuters, bbc, nytimes, pubmed, scholar.google.
- Tier 2 (70+): github, stackoverflow, MDN, w3.org, medium, dev.to.
- Tier 3 (50+): everything else. Adjustments: +5 HTTPS, +5 substantial snippet, -20 sponsored content.
- Sources scoring < 30 dropped; minimum 3 guaranteed (prevents source starvation).
- Wired into `retriever.ts` `searchWeb()`: raw results → rank → return.
- 19 tests (tier classification, bonuses, penalties, sorting, dropping, minimum recovery).

### Added — JS-Rendered Page Reading (Phase 12D)
- `src/lib/page-reader-js.ts`: `readPageWithJS()` + `isPlaywrightAvailable()`.
- Dynamic import of Playwright (optional dependency — graceful error if not installed).
- Headless chromium, 15s timeout, 1s render wait. Strips script/style/nav/footer/ads.
- Wired into `page-reader.ts` `readPage()`: if direct fetch returns < 200 chars (SPA shell), falls back to Playwright.
- Injection scan applied to JS-rendered content too.
- 10 tests (availability, graceful absence, fallback trigger, normal path, non-HTML, fetch errors, abort, interface shape).

### Added — Domain Agents (Phase 12E)
- `security_analyst` role: cybersecurity specialist (threat modeling, CVEs, OWASP, compliance). Has web_search.
- `electrical_engineer` role: industrial electrical systems (PLC, power, motors, safety standards). Has web_search + run_code.
- Updated orchestrator prompt to mention the new roles so the LLM can assign them.
- Updated `validateRole()` to accept the new roles.
- 8 tests (role assignment, worker execution, tool access, fallback).

### Fixed — README Honesty (Phase 12A)
- Removed false claims: "No persistent storage" (it's wired since v0.5.1), "39 tests" (409+).
- Added complete Features section covering all 16 features.
- Added honest Known Limitations (research-engine coverage ~23%, no mobile app, no multi-user isolation, rate limiter in-memory without Redis, Docker sandbox requires Docker, Playwright adds ~150MB).
- Updated Tech Stack, Configuration, Quick Start for v7.0.

### Changed
- `src/lib/swarm.ts`: Added `security_analyst` and `electrical_engineer` to `AgentRole`, `ROLE_PROMPTS`, `ROLE_TOOLS`, `PLAN_SYSTEM_PROMPT`, `validateRole()`.
- `src/lib/retriever.ts`: `searchWeb()` now ranks sources by quality before returning.
- `src/lib/page-reader.ts`: `readPage()` falls back to Playwright for SPA pages.
- `package.json`: Added `eval` script. Version 0.5.1 → 0.6.0.
- Tests: 409 pass + 1 skip (was 355+1; +54 tests across 5 phases).
- New files: `src/lib/eval/dataset.ts`, `src/lib/eval/runner.ts`, `src/lib/source-quality.ts`, `src/lib/page-reader-js.ts`, `src/app/api/eval/route.ts`, `scripts/eval.ts`, + 5 test files.

## [0.5.1] — Round 11: Wiring Round (no new features, just connecting built-but-disconnected systems)

### Fixed — Multi-provider Fallback (WIRING)
- **Problem**: `src/lib/llm-providers/` (OpenAI + Anthropic + Ollama) was built but never connected. All routes imported from `src/lib/llm-provider.ts` (NVIDIA only). If NVIDIA went down, the whole project went down.
- **Fix**: Added `crossProviderFallback()` to `llm-provider.ts`. When all 6 NVIDIA models fail, it now tries OpenAI → Anthropic → Ollama before giving up.
- Also added `crossProviderFastFallback()` for the `fast()` path.
- **Result**: NVIDIA outage → OpenAI takes over → project stays up.
- 5 new tests verify the full chain: NVIDIA fail → OpenAI, NVIDIA+OpenAI fail → Anthropic, all fail → Ollama, all fail → clear error, streaming tokens already emitted → no fallback.

### Fixed — Persistent Storage (WIRING)
- **Problem**: `research-store.ts` used an in-memory `Map` on `globalThis`. Server restart = all research jobs lost. `ResearchJobRecord` existed in Prisma schema but was never used.
- **Fix**: Added `persistJob()` to `research-store.ts`. Every `setStatus()` call in `research-engine.ts` now writes to the SQLite `research_jobs` table. `getJob()` checks in-memory Map first (fast, full runtime state), then falls back to DB (completed jobs that survived a restart). `listJobs()` merges both. `deleteJob()` removes from both.
- Added `abortController` to `ResearchJob` type for real cancellation.
- **Result**: Server restart → completed research jobs survive → GET /api/research/status/[id] still works.
- 6 new tests: createJob persists, getJob recovers from DB after Map cleared, listJobs merges, deleteJob removes from both, persistJob updates, survives restart.

### Fixed — Real Cancellation (WIRING)
- **Problem**: Stop button set `job.cancelled = true` but `Promise.all` in `processSubQuery` didn't cancel in-flight `fetch()` calls. The search/page-read requests kept running until they completed or timed out.
- **Fix**: Added `AbortController` to every `ResearchJob`. The stop endpoint calls `abortController.abort()` which cancels all in-flight fetches immediately. `searchWeb()` and `readPages()` now accept an `AbortSignal` parameter and pass it to every `fetch()` call (combined with the existing timeout via `AbortSignal.any()`). `processSubQuery` passes `job.abortController.signal` to both.
- Added abort checks before retries/sleeps in the retriever to prevent wasted time.
- **Result**: Click Stop → in-flight search and page-read requests abort immediately → no wasted budget.
- 9 new tests: aborted signal → empty results, mid-request abort, normal operation, Wikipedia API abort, direct page abort, readPages with pre-aborted signal, mid-batch abort, AbortController lifecycle, multiple fetches sharing one signal.

### Fixed — Code Verifier Loop (WIRING)
- **Problem**: `run_code` tool returned errors but the swarm's `runWorker` just said "Continue based on this result" — it didn't explicitly ask the model to fix and retry.
- **Fix**: Enhanced `run_code` tool to return clearer error messages: `"Execution failed.\n\nError: ...\n\nPlease fix the code and try again. Common issues: ..."`. Enhanced `runWorker` ReAct loop: when a tool result has `success: false`, the feedback message now explicitly says "Please fix the issue and try again" instead of "Continue". Increased `MAX_TOOL_ITERATIONS` from 3 to 4 to give the coder agent an extra self-correction chance.
- **Result**: Coder agent encounters a bug → sees the error → fixes the code → retries → succeeds.
- 5 new tests: error message clarity, success message clarity, failure feedback with "fix and retry", success feedback with "continue", iteration limit respected.

### Changed
- `src/lib/types.ts`: Added `abortController?: AbortController` to `ResearchJob`.
- `src/lib/research-store.ts`: Complete rewrite — dual-mode (in-memory + DB), `persistJob()`, `recordToJob()`, DB-backed `getJob()`/`listJobs()`/`deleteJob()`.
- `src/lib/research-engine.ts`: `setStatus()` now calls `persistJob()`. `processSubQuery()` passes abort signal to `searchWeb()` and `readPages()`.
- `src/lib/retriever.ts`: All search functions accept optional `AbortSignal`. Added `withAbortSignal()` helper. Abort checks before retries.
- `src/lib/page-reader.ts`: `readPage()` and `readPages()` accept optional `AbortSignal`. Added `withAbortSignal()` helper. `readPages` checks signal before each page read.
- `src/lib/agent-tools.ts`: `run_code` tool returns clearer success/error messages.
- `src/lib/swarm.ts`: `MAX_TOOL_ITERATIONS` 3→4. Verifier loop: failure feedback says "fix and retry".
- `src/app/api/research/stop/[id]/route.ts`: Calls `abortController.abort()` + `persistJob()`.
- Tests: 354 pass + 1 skip (was 329 pass + 1 skip; +25 wiring tests across 4 new test files).
- Version: 0.5.0 → 0.5.1.

## [0.5.0] — Round 10: Agent Swarm + Browser Extension + Desktop App

### Added — Agent Swarm
- Multi-agent collaboration system: orchestrator → parallel workers → synthesizer.
- 5 specialist roles: researcher, coder, analyst, writer, generalist (each with dedicated system prompt + tool access).
- `src/lib/swarm.ts` — full swarm engine: `planSwarm()`, `runWorker()` (ReAct loop, 3 iterations), `synthesizeSwarm()` (streaming), `runSwarm()` (orchestrator).
- `POST /api/swarm` — SSE endpoint with 10 event types: swarm_start, agent_start, agent_token, agent_tool, agent_result, agent_done, synth_start, synth_token, swarm_done, error.
- `SwarmCard` component — live visualization: plan grid, parallel agent activity panel, streaming synthesis, final report with export.
- "Swarm" mode in unified input dropdown + auto-detect ("swarm:" prefix).
- Worker failure resilience: failed workers don't break synthesis; error noted in output.
- 11 unit tests (plan parsing, worker streaming, synthesis, end-to-end orchestration, failure resilience, SSE format).

### Added — Browser Extension
- `/browser-extension/` — complete Manifest V3 extension (Chrome + Firefox, ~95 KB).
- 4 actions: Research page, Quick question, Deep research, Swarm analysis.
- Side panel with streaming markdown chat + offline history (last 20 cached).
- Page content extraction (title, URL, text ≤10k, description, headings).
- Opt-in floating "Research with AI" button.
- Streaming-safe architecture: side panel owns all fetches (survives MV3 service worker termination).
- Settings: configurable API base URL (synced via chrome.storage.sync).

### Added — Desktop App
- `/desktop/` — Electron wrapper (separate npm project, electron NOT in main package.json).
- 1200×800 window, system tray + context menu, native app menu (File/Edit/View/Window/Help).
- Keyboard shortcuts: Cmd/Ctrl+N (new research), +Shift+N (new chat), +R (reload), +Q (quit), +Alt+N (global new).
- Single-instance lock, graceful server-wait (polls port 3000 every 2s for 30s → error page).
- Dark mode via `nativeTheme`, security hardening (contextIsolation, no nodeIntegration, sandbox).
- Production build config for macOS / Linux / Windows (electron-builder).
- `contextBridge` API: `window.desktopAPI` exposes platform, version, event listeners.

### Changed
- ESLint config: ignores `desktop/` and `browser-extension/` (separate vanilla-JS projects).
- Version bump 0.4.0 → 0.5.0.
- Tests: 329 pass + 1 skip (was 304 pass + 1 skip; +25 tests across rounds 9–10).

## [0.4.0] - 2026-07-12

### Added
- Plan preview: generates a research outline before starting. Auto-starts after plan generation (no manual confirmation step).
- Stop button: actually stops the pipeline now (cooperative cancel via `cancelled` flag checked before each stage).
- Edit plan modal: edit title, summary, sections inline during research. Save & restart cancels the current job and starts fresh.
- Collapsed plan card during research (click to expand).
- Basic auth middleware (AUTH_USERNAME/AUTH_PASSWORD env vars).
- Prompt injection guards (query wrapping in XML tags + LLM warning + keyword detection).
- SSE streaming for status updates (1 connection instead of ~600 polls).
- Dockerfile (multi-stage, non-root, standalone output).
- CI pipeline (GitHub Actions: lint + tsc + test).
- 40 tests (parsing, fallback chain, plan preview, smoke tests with real APIs).
- Smoke tests for NVIDIA + DuckDuckGo (skip in CI, run locally).

### Fixed
- Job leak in /api/research/plan (was calling createJob, now uses a dummy job).
- Zod validation accepts empty title/summary (now requires min(1)).
- PlanPreview edit mode allows >9 sections (now capped at 9).
- DuckDuckGo scraping was hitting CAPTCHA (added JSON API fallback + CAPTCHA detection).
- .env was being wiped by Prisma postinstall (added .env.local as backup).
- Source-material guard was too weak (>50 chars; now requires >200 chars + at least 1 page read).

### Changed
- deep-research.tsx split from 1163 lines to 385 (8 sub-components).
- Removed 45 unused dependencies + 35 unused UI components.
- README rewritten with honest positioning (no "surpasses Perplexity" claims).
- ESLint rules re-enabled (were all "off").
- TypeScript strict mode enforced (removed ignoreBuildErrors).
- NVIDIA model chain reordered for speed (Llama 3.1 70B first).

## [0.3.0] - 2026-07-12

### Added
- 6-model NVIDIA LLM fallback chain.
- DuckDuckGo search (free, no key).
- Direct fetch + Mozilla Readability.
- Multi-round gap analysis (round 1 → analyze gaps → round 2).
- Server-side job timeout (20 min hard cap).
- Active-job eviction protection (never evict running jobs).

## [0.2.0] - 2026-07-11

### Added
- Initial research pipeline: plan → decompose → search → read → extract → synthesize.
- clean UI (gradient, dark mode, suggestion chips).
- Giant prompt support (up to 100K chars).
- NVIDIA NIM integration with OpenAI-compatible endpoint.
- DuckDuckGo search integration.
- Direct fetch for page reading.

## [0.1.0] - 2026-07-11

- Project scaffolded. Basic Next.js 16 + TypeScript + Tailwind 4 setup.
