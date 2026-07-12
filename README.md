# Deep Research Engine

A **self-hosted deep research engine** with multi-round gap analysis, triple-fallback resilience, and a Gemini-inspired UI. Runs entirely on free-tier APIs ($0/month).

> **Honest positioning:** This is not a Perplexity/ChatGPT Deep Research competitor. It's a self-hostable alternative in the same space as [GPT Researcher](https://github.com/assafelovic/gpt-researcher) — for people who want multi-round research on their own server, with their own API keys, at $0/month.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## What it does well

### Multi-round research pipeline
1. **Plan** — generates a structured outline (title + summary + 5-9 sections) before searching.
2. **Decompose** — breaks the query into focused sub-questions.
3. **Round 1** — for each sub-question (in parallel): search → read → extract findings.
4. **Gap analysis** — reviews round-1 findings, identifies what's missing, generates follow-up questions.
5. **Round 2** — processes gap-filling sub-questions (in parallel).
6. **Synthesize** — writes a long-form report following the plan outline.

### Triple-fallback resilience
- **6-model NVIDIA LLM fallback chain** — if one model fails (429/500/timeout), the next is tried instantly.
- **3-engine search fallback** — Tavily → Z.AI → DuckDuckGo.
- **2-backend page reader fallback** — Z.AI page_reader → direct HTTP fetch.

### Giant prompt support
- Accepts up to **100,000 characters** of research briefs.
- Auto-detects "Large prompt" (>4K chars) and "Mega prompt" (>15K chars).
- Useful for pasting RFPs, detailed research briefs, or multi-section requirements.

### Self-hostable
- Dockerfile included (multi-stage, non-root user, Next.js standalone).
- Your data never leaves your server.
- No per-user subscription.

## What it does NOT do (honestly)

- **No persistent storage.** Jobs are in-memory; a restart wipes everything. (TODO: Postgres backend.)
- **No streaming report.** The report appears all at once after synthesis, not token-by-token. (TODO: SSE for LLM output.)
- **No JS-rendered page reading.** SPA sites (React/Vue/Angular) return empty HTML. No Puppeteer/Playwright. (TODO.)
- **No source quality scoring.** Uses search-engine order as-is. No domain authority / page rank.
- **No citation verification.** The LLM may cite URLs that don't actually support the claim. No hallucination check.
- **Basic auth only.** No OAuth. (TODO.)
- **In-memory rate limiter.** Not suitable for multi-instance deployments. (TODO: Redis.)
- **28 tests.** Low coverage. No e2e tests yet.

If these gaps matter to you, this project isn't ready. Use [GPT Researcher](https://github.com/assafelovic/gpt-researcher) (more mature) or pay for Perplexity Pro.

## Quick Start

### Prerequisites
- Node.js 20+ / Bun
- An NVIDIA API key (free at https://build.nvidia.com/)
- (Optional) A Tavily API key (free at https://tavily.com/)

### Installation

```bash
git clone https://github.com/Abd123454/deep-research-engine.git
cd deep-research-engine
bun install
cp .env.example .env
# Edit .env: add NVIDIA_API_KEY and TAVILY_API_KEY
bun run dev
```

Open http://localhost:3000.

### Docker

```bash
docker build -t deep-research-engine .
docker run -p 3000:3000 --env-file .env deep-research-engine
```

## Configuration

All settings in `.env`. Key options:

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `nvidia` | `nvidia` or `zai` (free fallback) |
| `SMART_LLM_MODELS` | 6 models | Comma-separated NVIDIA fallback chain |
| `RETRIEVER` | `tavily` | `tavily`, `zai`, or `duckduckgo` |
| `SEARCH_DEPTH` | `advanced` | `standard` (~2-3 min), `deep` (~5-7 min), `advanced` (~10-15 min) |
| `NUM_SUB_QUERIES` | `7` | Sub-questions to generate (advanced) |
| `MAX_LINKS_PER_QUERY` | `15` | Pages to read per sub-question |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | empty | Set both to enable HTTP Basic Auth |

## Architecture

```
Next.js 16 UI (SSE) → API Routes → Research Engine (6-stage pipeline)
                                       ↓
                   ┌───────────────────┼───────────────────┐
                   │                   │                   │
              LLM Provider        Retriever          Page Reader
              (6 NVIDIA models    (Tavily → Z.AI →   (Z.AI → direct
               fallback chain)     DuckDuckGo)        fetch fallback)
```

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **LLMs:** NVIDIA NIM (6-model fallback) + Z.AI SDK
- **Search:** Tavily + Z.AI web_search + DuckDuckGo
- **Tests:** Vitest (28 unit + integration tests)
- **CI:** GitHub Actions (lint + tsc + test)

## Cost

**$0/month** on free tiers:
- NVIDIA NIM (free tier, 6 models)
- Tavily (1000 free searches/month)
- Z.AI SDK (free)
- DuckDuckGo (free, unlimited)
- Direct page fetch (free, unlimited)

## Roadmap

- [ ] Postgres-backed job store (replace in-memory Map)
- [ ] Streaming report (SSE for LLM token output)
- [ ] Playwright for JS-rendered pages
- [ ] Source quality scoring (domain authority + recency)
- [ ] Citation verification (URL actually supports the claim)
- [ ] Redis-backed rate limiter
- [ ] OAuth (GitHub/Google)
- [ ] 50+ tests + e2e (Playwright)

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- UI design inspired by Gemini Deep Research.
- Multi-round research pattern inspired by [GPT Researcher](https://github.com/assafelovic/gpt-researcher).
- Built with the Z.ai Code development platform.
