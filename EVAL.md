# Evaluation Baseline — v3.3.1

## Summary
- **Date:** 2026-07-17
- **Version:** v3.3.1 (commit c623e09)
- **Total queries:** 20 (5 factual + 5 coding + 10 research)
- **Previously run:** 5/20 (factual only, v7.1 baseline)
- **Current status:** Pending LLM API key — suite requires NVIDIA_API_KEY or alternative provider

## How to run the full suite

```bash
# Option 1: NVIDIA NIM (free key from https://build.nvidia.com/)
echo "NVIDIA_API_KEY=your-key-here" >> .env
bun run eval

# Option 2: Ollama (local, no API key needed)
# Install: https://ollama.ai
OLLAMA_URL=http://localhost:11434 bun run eval

# Option 3: OpenAI
echo "OPENAI_API_KEY=sk-..." >> .env
bun run eval

# Specific types:
bun run eval --type=factual    # 5 queries, ~30s
bun run eval --type=coding     # 5 queries, ~15min (swarm)
bun run eval --type=research   # 10 queries, ~50min (6-stage pipeline)
```

## Previous baseline (v7.1, 2026-07-15)

| Type | Passed | Total | Avg Score | Notes |
|---|---|---|---|---|
| factual | 4 | 5 | 80% | f2 failed (unit mismatch km/s vs m/s — fixed in v7.2) |
| coding | — | 5 | pending | Requires full swarm execution (~3 min each) |
| research | — | 10 | pending | Requires 6-stage pipeline (~5 min each) |

### Factual results (v7.1)

| ID | Query | Passed | Score | Time | Notes |
|---|---|---|---|---|---|
| f1 | Capital of France | ✅ | 100% | ~400ms | |
| f2 | Speed of light | ❌ | 0% | ~500ms | Test expects "km/s" but LLM returns "m/s". Acceptance criteria now accepts "299,792" alone. |
| f3 | Who wrote Hamlet | ✅ | 100% | ~600ms | |
| f4 | Chemical symbol gold | ✅ | 100% | ~550ms | |
| f5 | WW2 end year | ✅ | 100% | ~800ms | |

## Pending queries (to run with API key)

### Coding queries (5)
- c1: Write a function to reverse a string in Python
- c2: Implement binary search in JavaScript
- c3: Create a REST API endpoint for user CRUD
- c4: Write a SQL query to find duplicates
- c5: Implement a simple LRU cache

### Research queries (10)
- r1: Compare RISC-V and ARM architectures
- r2: Latest breakthroughs in quantum error correction
- r3: State of solid-state battery technology
- r4: How do LLM agents work?
- r5: Climate change impact on agriculture
- r6: History of Byzantine Empire
- r7: CRISPR gene editing applications
- r8: Renewable energy storage solutions
- r9: Machine learning in healthcare
- r10: Cryptocurrency regulation by country

## Acceptance criteria

- **factual:** LLM response contains the expected answer string (case-insensitive)
- **coding:** Generated code passes unit tests (syntax + logic)
- **research:** Report has ≥3 sources, ≥500 words, citation verification ≥80%

## Why the full suite hasn't run yet

The evaluation suite requires a working LLM provider. In the current sandbox:
- No NVIDIA_API_KEY configured
- No OpenAI/Anthropic keys
- Ollama not installed

When a key is available, run `bun run eval` and update this file with the complete results. This is the **baseline** — every future version should be compared against these numbers.

## What the eval measures

1. **Factual accuracy** — can the LLM answer simple questions correctly?
2. **Coding capability** — can the swarm (orchestrator + coder + synthesizer) produce working code?
3. **Research depth** — can the 6-stage pipeline produce a cited, sourced report?

These are the three core capabilities of Quaesitor. The eval suite is the objective measure of whether they work.
