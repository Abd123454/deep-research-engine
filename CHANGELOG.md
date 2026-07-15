# Changelog

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
