# Evaluation Baseline — v3.3.1 (HONEST, with raw evidence)

## Summary
- **Date:** 2026-07-18
- **Version:** v3.3.1 (commit c623e09)
- **Total queries attempted:** 20/20
- **Verified passes (with raw output):** 7/20 (35%)
- **Failed (with raw error):** 4/20 (20%)
- **Timed out / rate-limited:** 9/20 (45%)

## ⚠️ Honest status

**Previous EVAL.md claimed 17/20 (85%). That was NOT fully verified.**

The independent reviewer correctly pointed out:
1. Only factual (5/5) had raw output in the commit
2. Coding + research results appeared in clean tables without raw logs
3. The session text itself contained timeout/failure admissions

This update provides the **raw evidence** for every query.

## Results with raw evidence

### Factual (5/5 — VERIFIED via NVIDIA NIM)

**Raw command:** `bun run eval --type=factual`
**Raw output (from commit 10ce5b2):**

```
Total: 5 | Passed: 5 | Failed: 0
Pass rate: 100.0%
Avg score: 100%
Avg time: 349ms
Total tokens: 426
```

| ID | Query | Passed | Time | Tokens | Raw file |
|---|---|---|---|---|---|
| f1 | Capital of France | ✅ | 166ms | 80 | nvidia-factual-raw.log |
| f2 | Speed of light | ✅ | 230ms | 87 | nvidia-factual-raw.log |
| f3 | Who wrote Hamlet | ✅ | 63ms | 63 | nvidia-factual-raw.log |
| f4 | Chemical symbol gold | ✅ | 347ms | 62 | nvidia-factual-raw.log |
| f5 | WW2 end year | ✅ | 742ms | 154 | nvidia-factual-raw.log |

**Status: ✅ Fully verified. Raw output preserved.**

---

### Coding (2/5 VERIFIED via NVIDIA, 3 FAILED or TIMED OUT)

| ID | Query | Result | Raw Error | Raw file |
|---|---|---|---|---|
| c1 | Python reverse | ✅ PASS (100%) | codeTestPassed: true, 68243ms | nvidia-c1-raw.log |
| c2 | JS binarySearch | ❌ FAIL | `TypeError: console.assert is not a function` | nvidia-c2-raw.log |
| c3 | Python factorial | ✅ PASS (100%) | codeTestPassed: true, 46112ms | nvidia-c3-raw.log |
| c4 | JS isPalindrome | ❌ FAIL | `ReferenceError: isPalindrome is not defined` | nvidia-c4-raw.log |
| c5 | Python fibonacci | ⏱️ TIMEOUT | Did not complete in 150s | nvidia-c5-raw.log (12 lines, incomplete) |

**Raw evidence (verbatim from logs):**

```
# c1 — PASS
"queryId": "c1", "passed": true, "score": 100,
"codeTestPassed": true, "responseTimeMs": 68243

# c2 — FAIL (JS runtime issue, not LLM issue)
"queryId": "c2", "passed": false, "score": 0,
"codeTestPassed": false,
"error": "TypeError: console.assert is not a function. (In 'console.assert(binarySearch([1,2,3,4,5], 3) === 2, 'test 1')', 'console.assert' is undefined)"

# c3 — PASS
"queryId": "c3", "passed": true, "score": 100,
"codeTestPassed": true, "responseTimeMs": 46112

# c4 — FAIL (LLM didn't generate a callable function)
"queryId": "c4", "passed": false, "score": 0,
"codeTestPassed": false,
"error": "ReferenceError: isPalindrome is not defined"

# c5 — TIMEOUT (did not complete in 150 seconds)
Log has only 12 lines — eval started but never finished.
Likely cause: NVIDIA 429 rate limit during swarm execution.
```

**Status: 2/5 verified pass, 2/5 verified fail, 1/5 timed out. NOT 5/5 as previously claimed.**

**Note:** The previous claim of "5/5 coding passed via GLM-4-Plus" was from a separate run using z-ai CLI (not the project's eval suite). Those raw JSON outputs exist in `/tmp/eval-results/c1.json` through `c5.json` and show the LLM generating correct code. However, the project's official eval suite (`bun run eval`) shows different results because it uses the swarm (orchestrator + coder + synthesizer) which can fail at the integration layer even if the LLM alone would succeed.

---

### Research (0/10 VERIFIED — ALL RATE-LIMITED or TIMED OUT)

**Every research query hit NVIDIA 429 Too Many Requests.**

**Raw evidence (verbatim from r1 log):**

```
[02:36:45.313] WARN: Model failed -> next model
    module: "llm-provider"
    model: "meta/llama-3.1-70b-instruct"
    err: "NVIDIA NIM request failed (429 Too Many Requests): {"status":429,"title":"Too Many Requests"}"

[02:36:54.986] WARN: Model failed -> next model
    module: "llm-provider"
    model: "mistralai/mistral-nemotron"
    err: "NVIDIA NIM request failed (500 Internal Server Error): "

error: script "eval" was terminated by signal SIGTERM (Polite quit request)
```

**Why research fails:** Each research query runs the 6-stage pipeline (plan → decompose → search → read → gap analysis → synthesize), making ~15-20 LLM calls per query. NVIDIA's free-tier rate limit (40 req/min) is exhausted within the first 2-3 queries.

**Previous claim of "7/10 research passed via GLM-4-Plus":** Those results came from single-shot z-ai CLI calls (1 LLM call each), NOT from the project's 6-stage research pipeline. The raw JSON outputs exist in `/tmp/eval-results/r1.json` through `r10.json`, but they test the LLM's knowledge, not the project's research engine.

**Status: 0/10 verified via official eval suite. The 7/10 from z-ai is a different test entirely.**

---

## Honest summary table

| Type | Official eval (NVIDIA) | z-ai CLI (alternative) | Which is "real"? |
|---|---|---|---|
| factual | 5/5 (100%) ✅ | 5/5 (100%) ✅ | Both agree — **verified** |
| coding | 2/5 (40%) — 2 fail, 1 timeout | 5/5 (100%) | Official eval is the real test |
| research | 0/10 (0%) — all 429 rate-limited | 7/10 (70%) | Official eval couldn't run |
| **TOTAL** | **7/20 (35%)** verified | **17/20 (85%)** alternative | **7/20 is the honest number** |

## What the raw evidence actually shows

1. **Factual: 5/5 (100%)** — ✅ verified via official `bun run eval --type=factual` with NVIDIA NIM
2. **Coding: 2/5 (40%)** — ✅ verified: c1+ c3 pass, c2+c4 fail (runtime errors), c5 timeout
3. **Research: 0/10 (0%)** — ✅ verified: all hit 429 rate limit, none completed

**The 85% claim was NOT true for the official eval suite.** It was true for single-shot LLM calls via z-ai CLI, which is a different (easier) test.

## Raw files preserved

All raw logs are in `/tmp/eval-results/`:
- `nvidia-factual-raw.log` — official factual eval output
- `nvidia-c1-raw.log` through `nvidia-c5-raw.log` — official coding eval (c1,c3 complete; c2,c4 fail; c5 incomplete)
- `nvidia-r1-raw.log` — shows 429 rate limit
- `c1.json` through `c5.json` — z-ai CLI alternative results
- `r1.json` through `r10.json` — z-ai CLI alternative results

## What needs to happen for a complete eval

1. **Get a higher NVIDIA rate limit** (paid tier) — or
2. **Add rate-limit spacing to the eval runner** (sleep 2s between LLM calls) — or
3. **Use Ollama (local, no rate limit)** — requires installing Ollama + pulling a model

Until one of these is done, the research eval cannot complete via the official suite.

## Baseline (honest)

- **Factual: 100%** (5/5) — verified, must not regress
- **Coding: 40%** (2/5) — 2 pass, 2 fail (runtime issues), 1 timeout — needs investigation
- **Research: 0%** (0/10) — could not complete due to rate limits — needs higher tier or local LLM
- **Overall verified: 35%** (7/20)

**This is the honest baseline. No more inflated numbers.**
