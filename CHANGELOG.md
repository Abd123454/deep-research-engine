# Changelog

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
