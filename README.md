# Deep Research Engine

A **self-hosted deep research engine** with multi-round gap analysis, triple-fallback resilience, and a clean UI. Runs entirely on free-tier APIs ($0/month).

## Why I built this

I was paying $20/month for Perplexity Pro just for deep research. I wanted something I could run on my own server, with no limits, that I could hack on. This is that thing.

It's not as polished as Perplexity. It probably never will be. But it's mine, it's free, and it actually works for the kind of multi-hour research rabbit holes I fall into on weekends.

## What it does well

- **Multi-round research pipeline** — plan → decompose → search → gap analysis → round 2 → synthesize. The gap analysis step is the differentiator: after round 1, it reviews what was found, identifies what's missing, and runs a second round to fill the gaps.
- **Fallback resilience** — 6 NVIDIA LLM models (chain), 3 DuckDuckGo endpoints (HTML → lite → JSON), Mozilla Readability + regex fallback for pages. If one fails, the next takes over.
- **Giant prompt support** — paste up to 100,000 characters of research briefs, RFPs, or multi-section requirements.
- **Plan preview** — generates a research outline before starting. You can edit it, then the engine uses your version.
- **Self-hostable** — Dockerfile included. Your data stays on your server.

## What it does NOT do (honestly)

- **No persistent storage.** Jobs are in-memory; a restart wipes everything. (Working on it.)
- **No JS-rendered page reading.** SPA sites return empty HTML. No Puppeteer/Playwright yet.
- **No source quality scoring.** Uses search-engine order as-is.
- **No citation verification.** The LLM may cite URLs that don't support the claim.
- **Rate limiter is in-memory.** Won't work behind a load balancer. (Need Redis.)
- **39 tests.** Low coverage. No e2e tests yet.

If these gaps matter to you, this project isn't ready. Use [GPT Researcher](https://github.com/assafelovic/gpt-researcher) or pay for Perplexity Pro.

## Known Issues

- DuckDuckGo sometimes hits CAPTCHA. The engine falls back to Wikipedia + GitHub APIs.
- Advanced research can take 8-10 minutes. The report streams token-by-token via SSE.
- `Promise.all` doesn't abort in-flight sub-queries on cancel. The stop button stops the next stage, not the current HTTP requests in flight.

## Quick Start

```bash
git clone https://github.com/Abd123454/deep-research-engine.git
cd deep-research-engine
bun install
cp .env.example .env
# Edit .env: add NVIDIA_API_KEY (only key needed — search & page-reading are free)
bun run dev
```

Open http://localhost:3000.

### Docker

```bash
docker compose up -d   # uses docker-compose.yml with healthcheck
# or without compose:
docker build -t deep-research-engine .
docker run -p 3000:3000 --env-file .env deep-research-engine
```

Health check: `GET /api/health` returns `{status:"ok", uptime, version}`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `nvidia` | NVIDIA NIM only |
| `SMART_LLM_MODELS` | 6 models | Comma-separated NVIDIA fallback chain |
| `RETRIEVER` | `duckduckgo` | DuckDuckGo only |
| `SEARCH_DEPTH` | `advanced` | `standard` (~2-3 min), `deep` (~5-7 min), `advanced` (~10-15 min) |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | empty | Set both to enable HTTP Basic Auth |

## Tech Stack

- Next.js 16, TypeScript 5 (strict), Tailwind CSS 4, shadcn/ui
- NVIDIA NIM (6-model fallback), DuckDuckGo, Mozilla Readability
- Vitest (40 tests), GitHub Actions CI, Docker

## Cost

$0/month on free tiers.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- UI design inspired by deep research tools.
- Multi-round research pattern inspired by [GPT Researcher](https://github.com/assafelovic/gpt-researcher).
