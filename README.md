# Quaesitor

> 🚀 **Public Launch — v4.0.0** — the first stable public release.
> See [`RELEASE_NOTES.md`](RELEASE_NOTES.md) for the full announcement,
> [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) for the pre-launch
> checklist, and [`mobile/docs/MOBILE.md`](mobile/docs/MOBILE.md) for the
> mobile app scaffold.

> Self-hosted AI workstation — deep research, agent swarm, code execution, vision, and voice. Runs on free-tier APIs ($0/month).

**Version:** 4.0.0 (semver, public launch). Tags v6.x–v7.x were internal development rounds before the v1.0 stable release.

**Quaesitor** (from Latin *quaerere* — "to seek/investigate") is a complete AI platform that evolved through 12 development rounds from a single research script into a 16-feature workstation. It's not just a chat wrapper — it's a multi-agent system with real research capabilities, code execution, and persistent memory.

---

## Quick Start (3 commands)

```bash
git clone https://github.com/Abd123454/deep-research-engine.git && cd deep-research-engine
bun install && cp .env.example .env   # then edit .env: set NVIDIA_API_KEY (free at https://build.nvidia.com/)
bun run dev                            # open the Preview Panel, or http://localhost:3000
```

📖 **[Full release notes →](RELEASE_NOTES.md)** — what's new in v4.0.0,
what makes Quaesitor different, known limitations (honestly).
📱 **[Mobile app →](mobile/docs/MOBILE.md)** — Expo scaffold, biometric
auth, push notifications.
🔒 **[SOC 2 Type II audit docs →](legal/SOC2_TYPE_II_AUDIT.md)** — full
TSC mapping + evidence inventory + gap analysis.
📋 **[Launch checklist →](docs/LAUNCH_CHECKLIST.md)** — pre-launch
verification.

---

## Quick Start (Detailed)

```bash
# 1. Clone
git clone https://github.com/Abd123454/deep-research-engine.git
cd deep-research-engine

# 2. Install
bun install  # or: npm install (both work, no flags needed)

# 3. Configure
cp .env.example .env
# Edit .env: set NVIDIA_API_KEY (free at https://build.nvidia.com/)

# 4. Run
bun run dev

# Open http://localhost:3000
```

**That's it.** No Docker required for dev. No database setup (SQLite is built-in). No Redis required (in-memory fallback).

### What you get:
- 🧠 Deep research with 6-stage pipeline + citation verification
- 🤖 Agent swarm with 10 specialized roles (including device controller)
- 💬 Multi-turn chat with streaming + memory
- 🔒 Enterprise security (MFA, RBAC, audit logs, GDPR endpoints)
- 🎨 Independent "Amber & Ink" design (not a clone of any product)
- 📱 Mobile app scaffold (Expo)
- 🔌 Connectors framework (Slack, Notion, Drive, GitHub, Jira)
- 💳 Stripe billing with metered usage
- 🌍 Self-hosted, AGPL-3.0, $0/month

---

## Features

| Category | Feature | Status |
|----------|---------|--------|
| **AI Engine** | Deep research (6-stage pipeline) | ✅ |
| | Agent swarm (10 roles + parallel tools) | ✅ |
| | Multi-provider fallback (NVIDIA→OpenAI→Anthropic→Ollama) | ✅ |
| | Citation verification + NLI + self-critique | ✅ |
| | Prompt caching + research result cache | ✅ |
| **UX** | 3-column layout (Sidebar + Chat + Artifacts) | ✅ |
| | Canvas Mode (inline editing) | ✅ |
| | Command Palette (Cmd+K) | ✅ |
| | Inline citation hover cards | ✅ |
| | Streaming token animation | ✅ |
| | Streaming artifacts (live preview during generation) | ✅ |
| | Dark mode crossfade | ✅ |
| | Mobile responsive + sans-serif | ✅ |
| **Security** | MFA (TOTP RFC 6238) | ✅ |
| | RBAC (owner/admin/editor/viewer) | ✅ |
| | Docker sandbox (hardened) | ✅ |
| | SSRF protection (safeFetch) | ✅ |
| | CSRF protection | ✅ |
| | CSP + HSTS + security headers | ✅ |
| | Audit logging (27+ actions) | ✅ |
| | Sanitize errors (no secret leakage) | ✅ |
| **Memory** | 5-layer memory system | ✅ |
| | pgvector semantic search | ✅ |
| | Memory Graph (entity-relation) | ✅ |
| | Consent ledger (GDPR Art. 7) | ✅ |
| | Memory export (GDPR Art. 20) | ✅ |
| **Platform** | API Keys + public API | ✅ |
| | MCP transport (stdio + SSE) | ✅ |
| | Connectors (Slack/Notion/Drive/GitHub/Jira) | ✅ |
| | Computer Use (Playwright + Docker) | ✅ |
| | Device Control Agent (Win/macOS/Linux) | ✅ |
| | Real-time collaboration (Yjs + WebSocket) | ✅ |
| | Video understanding (keyframes + transcript) | ✅ |
| **Billing** | Stripe subscriptions | ✅ |
| | Metered billing (pay-as-you-go) | ✅ |
| | Plan limits enforcement | ✅ |
| **Compliance** | 11 legal documents | ✅ |
| | GDPR endpoints (Art. 7, 17, 20) | ✅ |
| | SOC 2 Type II readiness | ✅ |
| | SOC 2 Type II audit prep (control mapping) | ✅ |
| | Branch protection (no force push) | ✅ |
| **Mobile** | Expo app scaffold | ✅ |
| | Biometric auth ready | ✅ |
| | Push notifications ready | ✅ |

---

## Why Quaesitor exists

I was paying $20/month for Perplexity Pro just for deep research. I wanted something I could run on my own server, with no limits, that I could hack on. This is that thing.

It's not as polished as commercial tools. It probably never will be. But it's mine, it's free, and it actually works for the kind of multi-hour research rabbit holes I fall into on weekends.

---

## Feature Overview

### Research & Knowledge
- **Deep Research** — 6-stage pipeline: plan → decompose → search → gap analysis → round 2 → synthesize. Citation verification checks every URL.
- **Source Quality Scoring** — tier-based ranking: academic/government (tier 1) → industry (tier 2) → general web (tier 3). Weak sources dropped.
- **JS-Rendered Page Reading** — Playwright headless browser fallback for SPA sites (React/Vue/Angular).

### Agentic Capabilities
- **Agentic Chat** — ReAct (Reason + Act) loop with native tool calling. Skills: Default, Coder, Researcher, Writer, Data Analyst.
- **Agent Swarm** — orchestrator breaks tasks, specialists run in parallel, synthesizer combines outputs. 7 roles: researcher, coder, analyst, writer, generalist, security_analyst, electrical_engineer.
- **Code Sandbox** — JavaScript (vm) + Python (subprocess) + Docker (isolated). Verifier loop: code fails → agent fixes → retries.

### Multimodal
- **Vision** — 4-provider fallback: OpenAI GPT-4o → Anthropic Claude 3.5 → NVIDIA Llama 3.2 → Tesseract OCR.
- **Voice** — TTS (text-to-speech) + ASR (speech-to-text).
- **File Generation** — PDF, DOCX, PPTX, XLSX export.

### Interface
- **3-column layout** — Sidebar (conversations) + Chat (main) + Artifacts (interactive HTML/React/SVG/code).
- **5-layer memory** — conversation, long-term (text-based semantic search via LIKE), research history, documents, preferences.
- **PWA** — installable, offline indicator, service worker.

### Cross-Platform
- **Browser Extension** — Chrome/Firefox (Manifest V3): capture any page and research it.
- **Desktop App** — Electron wrapper: system tray, native menu, keyboard shortcuts.

### Infrastructure
- **Multi-provider LLM** — NVIDIA (6-model chain) → OpenAI → Anthropic → Ollama. Cross-provider fallback on failure.
- **Persistent Storage** — SQLite (dev) + Postgres/Prisma (prod). Jobs, conversations, documents, memories survive restarts.
- **Real Cancellation** — AbortController cancels in-flight HTTP requests immediately.
- **Security** — prompt-injection defense (multi-language + Unicode), CORS enforcement, rate limiting, file upload validation, indirect injection scanning.

---

## Quick Start (Detailed Setup)

```bash
git clone https://github.com/Abd123454/deep-research-engine.git
cd deep-research-engine
bun install
cp .env.example .env
# Edit .env: add NVIDIA_API_KEY (free at https://build.nvidia.com/)
bun run dev
```

Open http://localhost:3000 (or use the Preview Panel in your IDE).

### Docker

```bash
docker compose up -d
# or:
docker build -t quaesitor .
docker run -p 3000:3000 --env-file .env quaesitor
```

### Browser Extension

```bash
# Chrome: chrome://extensions → Developer mode → Load unpacked → select browser-extension/
# Firefox: about:debugging → This Firefox → Load Temporary Add-on → select manifest.json
```

### Desktop App

```bash
cd desktop
npm install
npm run dev   # requires the Next.js app running on port 3000
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `NVIDIA_API_KEY` | — | Primary LLM (free at build.nvidia.com). 6-model fallback chain. |
| `OPENAI_API_KEY` | — | Cross-provider fallback #1. |
| `ANTHROPIC_API_KEY` | — | Cross-provider fallback #2. |
| `OLLAMA_URL` | — | Cross-provider fallback #3 (local LLM). When set as `LLM_PROVIDER=ollama`, all LLM inference runs locally (0 g remote CO₂). |
| `SMART_LLM_MODELS` | 6 models | Comma-separated NVIDIA fallback chain. |
| `DATABASE_URL` | `file:./db/custom.db` | SQLite (dev) or `postgresql://...` (prod). |
| `REDIS_URL` | — | Optional. Enables BullMQ job queue for research, email, memory (run `bun run worker` separately). |
| `MAX_JOBS` | `100` | In-memory research job cap. With BullMQ, overflow jobs stay queued in Redis; without, the oldest inactive job is evicted (DB row survives). |
| `NEXT_PUBLIC_LLM_PROVIDER` | — | Optional. Set to `ollama` to expose local-mode to the client (carbon indicator shows "0g CO₂ (local)" for research reports). |
| `SEARCH_DEPTH` | `advanced` | `standard` (~2-3 min), `deep` (~5-7 min), `advanced` (~10-15 min). |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | empty | Set both to enable HTTP Basic Auth. |
| `MAX_DOCUMENT_SIZE_MB` | `50` | File upload limit. |

### Environmental Impact

Quaesitor displays a carbon-footprint estimate at the bottom of every chat
response and research report. Configure **Ollama** for zero-carbon local
inference — the indicator switches to "0g CO₂ (local)". See
[`docs/ENVIRONMENTAL.md`](docs/ENVIRONMENTAL.md) for full setup, renewable-energy
server recommendations, and the estimation methodology.

---

## Evaluation

Quaesitor includes a built-in evaluation harness to measure quality with real numbers:

```bash
bun run eval                    # run all 20 queries
bun run eval --type=factual     # factual only (fast, ~30s)
bun run eval r1 r2 f1           # specific queries
```

The suite tests research queries (source + keyword verification), coding queries (automated test execution), and factual queries. See [EVAL.md](EVAL.md) for baseline results.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4, shadcn/ui (New York), Lucide icons
- **Database**: Prisma ORM (Postgres prod / SQLite dev)
- **Auth**: NextAuth.js v4
- **LLM**: NVIDIA NIM (primary), OpenAI, Anthropic, Ollama (fallbacks)
- **Search**: DuckDuckGo (3 endpoints), Wikipedia API, GitHub API
- **Page Reading**: Mozilla Readability + Playwright (JS-rendered fallback)
- **Sandbox**: Node.js vm + Python subprocess + Docker
- **Testing**: Vitest (433+ unit/integration tests), Playwright (8 E2E tests)
- **CI**: GitHub Actions (lint + tsc + test + deploy)

---

## Testing

```bash
# Unit + integration tests
bun run test

# E2E tests (requires dev server, first time: bun run e2e:install)
bun run e2e

# Evaluation harness
bun run eval

# Lint
bun run lint

# Type check
bunx tsc --noEmit
```

---

## Known Limitations (honestly)

- **Semantic search uses LIKE** (not pgvector) — sufficient for SQLite/single-user, upgrade to Postgres for production scale.
- **research-engine.ts coverage: ~60%** (improved from 23% in v1.2.0, targeting 80%).
- **No mobile app** — the web app is responsive but not a native mobile experience.
- **No multi-user isolation** — single-user by default. NextAuth v4 is integrated but RBAC is not.
- **Rate limiter uses in-memory fallback** — Redis is supported but optional. Without Redis, rate limiting is per-process.
- **Docker sandbox requires Docker installed** — falls back to vm sandbox if unavailable.
- **Playwright adds ~150MB** — optional, for JS-rendered page reading + E2E tests.
- **Dev-dependency vulnerabilities** — `vite`, `minimatch` (via eslint/vitest/prisma dev tools) have HIGH advisories. These are dev-only deps, not in production runtime. Upgrading requires major version bumps that may break the toolchain.
- **Dead code** — `src/components/deep-research.tsx` (legacy component, replaced by `UnifiedInterface`) and `src/hooks/use-mobile.ts` (unused shadcn/ui hook) are still present but not imported by any production route. Safe to remove in a future cleanup.

---

## Architecture

```
User Input
    │
    ├─ Quick Question ──→ LLM (single call, streaming)
    │
    ├─ Deep Research ──→ 6-stage pipeline:
    │     plan → decompose → search → read → gap analysis → synthesize
    │     (citation verification + source quality scoring)
    │
    ├─ Agent Chat ──→ ReAct loop (think → tool call → feedback → continue)
    │
    └─ Agent Swarm ──→ orchestrator → parallel workers → synthesizer
        7 roles: researcher, coder, analyst, writer,
                 generalist, security_analyst, electrical_engineer
```

---

## Cost

$0/month on free tiers (NVIDIA NIM is free; search and page-reading use free APIs).

With cross-provider fallback, you can add paid providers (OpenAI/Anthropic) for redundancy without changing any code — they're only used if NVIDIA fails.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

AGPL-3.0 — see [LICENSE](LICENSE). In short: you can use, modify, and distribute Quaesitor (including as a network service), but any modifications you share or serve over a network must also be released under AGPL-3.0 with full source code.

## Acknowledgments

- Multi-round research pattern inspired by [GPT Researcher](https://github.com/assafelovic/gpt-researcher).
- UI design inspired by deep research tools and AI chat interfaces.
- Evaluation methodology inspired by [Open Deep Research](https://github.com/langchain-ai/open_deep_research).
