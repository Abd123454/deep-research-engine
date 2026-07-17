# Environmental Impact & Low-Carbon Operation

Quaesitor is designed to run on free-tier APIs, but free doesn't have to mean
carbon-heavy. This document explains how to minimize the carbon footprint of
your Quaesitor deployment and how the on-screen carbon indicator works.

---

## The Carbon Indicator

Every deep research report and chat response now displays a small carbon
footprint estimate at the bottom:

```
🌿 2.3g CO₂ estimated · See impact
```

Hover the indicator to see the breakdown (LLM inference / web search / page
reading) and the data source.

When Quaesitor is configured to use **Ollama** (local inference), the
indicator changes to:

```
🌿 0g CO₂ (local) · See impact
```

This means the LLM ran on your own hardware — no remote API was called, so
the *remote* carbon cost is zero. The actual carbon depends on your local
electricity source (see "Going Further" below).

### How the estimate is calculated

The estimator uses conservative mid-range public figures from 2024 LLM
energy research:

| Component                | Rate                         | Source                                  |
|--------------------------|------------------------------|-----------------------------------------|
| LLM inference (small ≤7B)| 0.3 g CO₂ / 1K tokens        | Public LLM energy benchmarks            |
| LLM inference (medium 8B–70B) | 0.6 g CO₂ / 1K tokens    | Public LLM energy benchmarks            |
| LLM inference (large >70B) | 1.0 g CO₂ / 1K tokens      | Public LLM energy benchmarks            |
| NVIDIA NIM (US, 2024)    | ~0.5–1 g CO₂ / 1K tokens     | NVIDIA PUE ~1.1, US grid intensity      |
| Web search (DuckDuckGo)  | 0.2 g CO₂ / query            | Estimated network + indexing energy     |
| Page reading (Playwright)| 0.2 g CO₂ / page loaded      | Headless browser energy per page        |

These are **rough estimates for user awareness**, not precise accounting. For
rigorous carbon measurement, integrate with [Cloud Carbon Footprint](https://www.cloudcarbonfootprint.org/)
or [Green Algorithms](https://www.green-algorithms.org/).

The model-size bucket is inferred from the model name (e.g. `llama-3.1-70b`
→ large, `llama-3.1-8b` → medium).

### Where the numbers come from

- `src/lib/carbon-footprint.ts` — the estimator itself (pure functions, no I/O).
- `src/components/cards/ResearchCard.tsx` — renders the indicator for research.
- `src/components/cards/ChatCard.tsx` — renders the indicator for chat.

---

## Configuring Ollama for Zero-Carbon Local Inference

[Ollama](https://ollama.com) is a free, open-source local LLM runtime. When
configured as Quaesitor's LLM provider, **all LLM inference happens on your
own hardware** — no remote API calls, so the remote carbon cost is zero.

### 1. Install Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Or download the Windows installer from https://ollama.com
```

### 2. Pull a model

```bash
# Recommended for research (best quality, needs ~40GB RAM):
ollama pull llama3.1:70b

# Balanced (needs ~8GB RAM):
ollama pull llama3.1:8b

# Fast/light (needs ~5GB RAM):
ollama pull qwen2.5:7b
```

### 3. Configure Quaesitor

Add to your `.env`:

```bash
# Use Ollama as the ONLY provider (no remote calls at all)
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODELS=llama3.1:70b,llama3.1:8b,qwen2.5:7b
OLLAMA_FAST_MODEL=llama3.1:8b

# Optional: expose the provider to the client so the carbon indicator
# shows "0g CO₂ (local)" for research reports (chat already detects this
# automatically from the SSE stream).
NEXT_PUBLIC_LLM_PROVIDER=ollama
```

### 4. Verify

Start Quaesitor (`bun run dev`) and ask a question in chat. The carbon
indicator should read `0g CO₂ (local)`. For deep research, set
`NEXT_PUBLIC_LLM_PROVIDER=ollama` and the research card will show the same.

### What still emits CO₂

Even with Ollama, two operations still make network calls:

1. **Web search** (DuckDuckGo) — ~0.2 g CO₂ per query. This is unavoidable
   for real research; the alternative is to disable web search entirely
   (`SEARCH_DEPTH=standard` with no external retriever).
2. **Page reading** — fetching the actual article URLs. ~0.2 g CO₂ per page.

The carbon indicator accounts for both even in local mode.

---

## Going Further: Renewable-Energy-Powered Servers

If you're running Ollama on your own server, the *actual* carbon footprint
depends on your electricity source. To go fully zero-carbon:

1. **Run on a renewable-energy-powered VPS.** Providers like [Hetzner](https://www.hetzner.com/)
   (hydro + wind), [GreenGeeks](https://www.greengeeks.com/), or
   [ECO Web Hosting](https://www.ecowebhosting.co.uk/) purchase renewable
   credits matching their data-center power draw.
2. **Self-host on solar.** A home server + battery + solar panels can run
   Quaesitor 100% carbon-free during daylight hours. Battery sizing:
   ~200Wh for a Mini-PC running Ollama 8B at peak load.
3. **Co-locate with hydro.** If you have access to hydro power (e.g. Pacific
   Northwest US, Norway, Iceland), the marginal carbon intensity is near
   zero year-round.

### Checking your grid intensity

- **US**: [EPA Power Profiler](https://www.epa.gov/egrid/power-profiler)
- **EU**: [Electricity Maps](https://www.electricitymaps.com/)
- **Global real-time**: [electricityMap API](https://api.electricitymap.org/)

A typical US grid intensity is ~380 g CO₂/kWh; a renewable-powered data
center is ~30–50 g CO₂/kWh (10× lower).

---

## Redis / BullMQ: Lower Idle Power

Quaesitor's research pipeline can run inline (default) or via BullMQ + Redis
when `REDIS_URL` is set. The BullMQ path is **more carbon-efficient** at scale
because:

- The web server stays responsive (lower p99 latency → fewer timeouts → fewer
  re-runs).
- The worker process can be pinned to a single core / lower-power node.
- Jobs are deduplicated by the research cache (see `src/lib/research-cache.ts`),
  so identical queries within 24h skip the pipeline entirely.

To enable:

```bash
# .env
REDIS_URL=redis://localhost:6379

# Terminal 1: web server
bun run dev

# Terminal 2: worker process
bun run worker
```

---

## Summary

| Configuration                          | LLM CO₂ | Search CO₂ | Total per research |
|----------------------------------------|---------|------------|--------------------|
| NVIDIA NIM (default, 70B model)        | ~6 g    | ~1 g       | ~7–10 g CO₂        |
| NVIDIA NIM (8B fast model)             | ~1.5 g  | ~1 g       | ~2.5–4 g CO₂       |
| **Ollama local (any model)**           | **0 g** | ~1 g       | **~1–2 g CO₂**     |
| Ollama + renewable-powered server      | **0 g** | ~0.1 g     | **~0.1–0.2 g CO₂** |

Even a single switch to Ollama cuts the carbon footprint by ~70–85%, because
LLM inference dominates the total. Combined with a renewable-powered server,
the marginal carbon of a deep research run drops below 0.2 g CO₂ — roughly
the same as loading one web page.

---

## See Also

- [DESIGN.md](../DESIGN.md) — Quaesitor design system
- [README.md](../README.md) — Project overview and setup
- `src/lib/carbon-footprint.ts` — the estimator
- `src/lib/research-cache.ts` — result caching (avoids re-runs)
