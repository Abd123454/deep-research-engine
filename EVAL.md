# Evaluation Baseline — v7.1

## Summary
- **Date:** 2026-07-15
- **Version:** v7.1
- **Total queries run:** 5/20 (factual only — coding/research require extended runtime)
- **Passed:** 4/5 (80%)
- **Avg score:** 80%
- **Avg time:** 563ms
- **Total tokens:** 441

## Results by type

| Type | Passed | Total | Avg Score |
|---|---|---|---|
| factual | 4 | 5 | 80% |
| coding | — | 5 | pending |
| research | — | 10 | pending |

## Individual results

| ID | Query | Type | Passed | Score | Time | Tokens | Notes |
|---|---|---|---|---|---|---|---|
| f1 | Capital of France | factual | ✅ | 100% | ~400ms | ~80 | |
| f2 | Speed of light | factual | ❌ | 0% | ~500ms | 87 | Test expects "km/s" but LLM returns "m/s". Fixed in v7.2 — now accepts "299,792" alone. |
| f3 | Who wrote Hamlet | factual | ✅ | 100% | ~600ms | 63 | |
| f4 | Chemical symbol gold | factual | ✅ | 100% | ~550ms | 62 | |
| f5 | WW2 end year | factual | ✅ | 100% | ~800ms | 169 | |

## Pending
- **coding queries (5):** require full swarm execution (~3 min each — orchestrator + coder agent + synthesizer)
- **research queries (10):** require full 6-stage research pipeline (~5 min each — plan + decompose + search + read + gap analysis + synthesize)

## How to run

```bash
# Factual only (fast, ~30 seconds)
bun run eval --type=factual

# Specific queries
bun run eval f1 f2 f3

# Coding (slow, ~3 min each)
bun run eval c1 c2 c3 c4 c5

# Research (slow, ~5 min each)
bun run eval r1 r2 r3

# Everything (30+ minutes)
bun run eval
```

## Notes
- This is a **partial baseline**. Full eval requires a server with more resources/headroom.
- The f2 failure was a **test design issue**, not an LLM quality issue — the LLM answered correctly ("299,792,458 m/s") but the test checked for "km/s". Fixed in v7.2.
- **Every future round must show before/after EVAL.md diff.**
- Factual queries use the `fast()` LLM path (single call, ~200ms).
- Coding queries use the **swarm** (3+ LLM calls).
- Research queries use the **full 6-stage pipeline** (10+ LLM calls + web searches).

## Environment
- **LLM:** NVIDIA NIM (meta/llama-3.1-70b-instruct)
- **Fast model:** meta/llama-3.1-8b-instruct
- **Database:** SQLite
- **Search:** DuckDuckGo + Wikipedia + GitHub
- **Node:** 20+
- **Bun:** latest
