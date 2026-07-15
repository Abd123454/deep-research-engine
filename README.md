# Quaesitor

> Self-hosted AI workstation — deep research, agent swarm, code execution, vision, and voice. Runs on free-tier APIs ($0/month).

**Quaesitor** (from Latin *quaerere* — "to seek/investigate") is a complete AI platform that evolved through 12 development rounds from a single research script into a 16-feature workstation. It's not just a chat wrapper — it's a multi-agent system with real research capabilities, code execution, and persistent memory.

## Why Quaesitor exists

I was paying $20/month for Perplexity Pro just for deep research. I wanted something I could run on my own server, with no limits, that I could hack on. This is that thing.

It's not as polished as commercial tools. It probably never will be. But it's mine, it's free, and it actually works for the kind of multi-hour research rabbit holes I fall into on weekends.

---

## Features

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
- **5-layer memory** — conversation, long-term semantic, research history, documents, preferences.
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

## Quick Start

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
| `OLLAMA_URL` | — | Cross-provider fallback #3 (local LLM). |
| `SMART_LLM_MODELS` | 6 models | Comma-separated NVIDIA fallback chain. |
| `DATABASE_URL` | `file:./db/custom.db` | SQLite (dev) or `postgresql://...` (prod). |
| `REDIS_URL` | — | Optional. Distributed rate limiting. |
| `SEARCH_DEPTH` | `advanced` | `standard` (~2-3 min), `deep` (~5-7 min), `advanced` (~10-15 min). |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | empty | Set both to enable HTTP Basic Auth. |
| `MAX_DOCUMENT_SIZE_MB` | `50` | File upload limit. |

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
- **Testing**: Vitest (409+ tests)
- **CI**: GitHub Actions (lint + tsc + test + deploy)

---

## Known Limitations (honestly)

- **research-engine.ts test coverage: ~23%** — targeting 60%. The eval harness is the first step toward measuring this.
- **No mobile app** — the web app is responsive but not a native mobile experience.
- **No multi-user isolation** — single-user by default. NextAuth v4 is integrated but RBAC is not.
- **Rate limiter uses in-memory fallback** — Redis is supported but optional. Without Redis, rate limiting is per-process.
- **Docker sandbox requires Docker installed** — falls back to vm sandbox if unavailable.
- **Playwright adds ~150MB** — optional, only for JS-rendered page reading.

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

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- Multi-round research pattern inspired by [GPT Researcher](https://github.com/assafelovic/gpt-researcher).
- UI design inspired by deep research tools and AI chat interfaces.
- Evaluation methodology inspired by [Open Deep Research](https://github.com/langchain-ai/open_deep_research).
