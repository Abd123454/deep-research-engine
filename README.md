# Deep Research Engine

A **self-hosted AI workstation** — deep research, agentic chat, multi-agent swarm, code execution, vision, voice, and more. Runs on free-tier APIs ($0/month) with cross-provider resilience.

## What it does

This is a full AI platform, not just a research tool. It evolved through 12 development rounds from a single research script into a 16-feature workstation.

### Features

**Research & Knowledge**
- **Deep Research** — 6-stage pipeline: plan → decompose → search → gap analysis → round 2 → synthesize. Citation verification checks that every URL in the report actually exists in the sources.
- **Source Quality Scoring** — every source is ranked by domain tier (academic/government/established media → industry → general web) and weak sources are dropped.
- **JS-Rendered Page Reading** — Playwright headless browser fallback for SPA sites (React/Vue/Angular) that return empty HTML to direct fetch.

**Agentic Capabilities**
- **Agentic Chat** — ReAct (Reason + Act) loop with native tool calling. Skills system: Default, Coder, Researcher, Writer, Data Analyst.
- **Agent Swarm** — multi-agent collaboration: an orchestrator breaks complex tasks into subtasks, specialist workers run in parallel, a synthesizer combines their outputs. Roles: researcher, coder, analyst, writer, generalist, security_analyst, electrical_engineer.
- **Code Sandbox** — JavaScript (vm sandbox) + Python (subprocess) + Docker (isolated container). Verifier loop: if code execution fails, the agent gets the error and retries with a fix.

**Multimodal**
- **Vision** — 4-provider fallback: OpenAI GPT-4o → Anthropic Claude 3.5 → NVIDIA Llama 3.2 → Tesseract OCR.
- **Voice** — TTS (text-to-speech) + ASR (speech-to-text).
- **File Generation** — PDF, DOCX, PPTX, XLSX export.

**Interface**
- **3-column layout** — Sidebar (conversations) + Chat (main) + Artifacts (interactive results: HTML, React, SVG, code).
- **5-layer memory** — conversation history, long-term semantic memory, research history, document memory, user preferences.
- **PWA** — installable, offline indicator, service worker.

**Cross-Platform**
- **Browser Extension** — Chrome/Firefox (Manifest V3): capture any page and research it.
- **Desktop App** — Electron wrapper: system tray, native menu, keyboard shortcuts.

**Infrastructure**
- **Multi-provider LLM** — NVIDIA (6-model chain) → OpenAI → Anthropic → Ollama. If NVIDIA goes down, OpenAI takes over automatically.
- **Persistent Storage** — SQLite (development) + Postgres/Prisma (production). Research jobs, conversations, documents, and memories survive server restarts.
- **Real Cancellation** — AbortController cancels in-flight HTTP requests immediately when you click Stop. No wasted budget.
- **Security** — prompt injection defense (multi-language + Unicode), CORS enforcement, rate limiting (5/min + 3 concurrent + 50/day), file upload validation, indirect injection scanning on page content.

### Evaluation

Run the eval harness to measure quality with real numbers:

```bash
bun run eval
```

Tests research queries (source + keyword checks), coding queries (automated test execution), and factual queries. Outputs pass rate, average score, tokens used, and response time.

## Known Limitations (honestly)

- **research-engine.ts test coverage: ~23%** — targeting 60%. The eval harness (v7.0) is the first step toward measuring this.
- **No mobile app** — planned for a future release. The web app is responsive but not a native mobile experience.
- **No multi-user isolation** — single-user by default. NextAuth v4 is integrated but role-based access control is not implemented.
- **Rate limiter uses in-memory fallback** — Redis is supported but optional. Without Redis, rate limiting is per-process (won't work behind a load balancer).
- **Docker sandbox requires Docker installed** — falls back to vm sandbox if Docker is unavailable. The vm sandbox is less isolated.
- **Playwright adds ~150MB** — only installed if you need JS-rendered page reading. The default page reader (direct fetch + Readability) works for 90% of sites.

If these gaps matter to you, this project may not be ready. Consider [GPT Researcher](https://github.com/assafelovic/gpt-researcher) or [Open WebUI](https://github.com/open-webui/open-webui).

## Quick Start

```bash
git clone https://github.com/Abd123454/deep-research-engine.git
cd deep-research-engine
bun install
cp .env.example .env
# Edit .env: add at least one LLM key (NVIDIA_API_KEY is free at https://build.nvidia.com/)
bun run dev
```

Open http://localhost:3000 (or use the Preview Panel in your IDE).

### Docker

```bash
docker compose up -d   # uses docker-compose.yml with healthcheck
# or without compose:
docker build -t deep-research-engine .
docker run -p 3000:3000 --env-file .env deep-research-engine
```

Health check: `GET /api/health` returns `{status, uptime, version, checks}`.

### Browser Extension

```bash
# Chrome: chrome://extensions → Developer mode → Load unpacked → select browser-extension/
# Firefox: about:debugging → This Firefox → Load Temporary Add-on → select manifest.json
```

### Desktop App

```bash
cd desktop
npm install   # one-time
npm run dev   # requires the Next.js app running on port 3000
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `NVIDIA_API_KEY` | — | Primary LLM (free at build.nvidia.com). 6-model fallback chain. |
| `OPENAI_API_KEY` | — | Cross-provider fallback #1. |
| `ANTHROPIC_API_KEY` | — | Cross-provider fallback #2. |
| `OLLAMA_URL` | — | Cross-provider fallback #3 (local LLM). |
| `SMART_LLM_MODELS` | 6 models | Comma-separated NVIDIA fallback chain. |
| `DATABASE_URL` | `file:./db/custom.db` | SQLite (development) or `postgresql://...` (production). |
| `REDIS_URL` | — | Optional. Distributed rate limiting. |
| `SEARCH_DEPTH` | `advanced` | `standard` (~2-3 min), `deep` (~5-7 min), `advanced` (~10-15 min). |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | empty | Set both to enable HTTP Basic Auth. |
| `MAX_DOCUMENT_SIZE_MB` | `50` | File upload limit. |

## Tech Stack

- **Framework**: Next.js 16 (App Router), TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4, shadcn/ui (New York), Lucide icons
- **Database**: Prisma ORM (Postgres production / SQLite development)
- **Auth**: NextAuth.js v4
- **LLM**: NVIDIA NIM (primary), OpenAI, Anthropic, Ollama (fallbacks)
- **Search**: DuckDuckGo (3 endpoints), Wikipedia API, GitHub API
- **Page Reading**: Mozilla Readability + Playwright (JS-rendered fallback)
- **Sandbox**: Node.js vm + Python subprocess + Docker
- **Testing**: Vitest (355+ tests)
- **CI**: GitHub Actions (lint + tsc + test)

## Evaluation Results

Run `bun run eval` to generate fresh numbers. The eval suite covers:
- 10 research queries (source + keyword verification)
- 5 coding queries (automated test execution)
- 5 factual queries (keyword verification)

See [EVAL.md](EVAL.md) for the latest results.

## Cost

$0/month on free tiers (NVIDIA NIM is free; search and page-reading use free APIs).

With cross-provider fallback, you can add paid providers (OpenAI/Anthropic) for redundancy without changing any code — they're only used if NVIDIA fails.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- Multi-round research pattern inspired by [GPT Researcher](https://github.com/assafelovic/gpt-researcher).
- UI design inspired by deep research tools and AI chat interfaces.
- Evaluation methodology inspired by [Open Deep Research](https://github.com/langchain-ai/open_deep_research).
