# Changelog

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
- Smoke tests for real Tavily + NVIDIA APIs (skip in CI, run locally).

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
- 3-engine search fallback (Tavily → Z.AI → DuckDuckGo).
- 2-backend page reader fallback (Z.AI → direct HTTP fetch).
- Multi-round gap analysis (round 1 → analyze gaps → round 2).
- Server-side job timeout (20 min hard cap).
- Active-job eviction protection (never evict running jobs).

## [0.2.0] - 2026-07-11

### Added
- Initial research pipeline: plan → decompose → search → read → extract → synthesize.
- Gemini-inspired UI (gradient, dark mode, suggestion chips).
- Giant prompt support (up to 100K chars).
- NVIDIA NIM integration with OpenAI-compatible endpoint.
- Tavily search integration.
- Z.AI SDK for free fallback (web_search + page_reader).

## [0.1.0] - 2026-07-11

- Project scaffolded. Basic Next.js 16 + TypeScript + Tailwind 4 setup.
