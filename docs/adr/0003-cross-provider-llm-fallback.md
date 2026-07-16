# ADR-0003: Cross-provider LLM Fallback Chain (NVIDIA → OpenAI → Anthropic → Ollama)

## Status
Accepted (2026-07-16)

## Context
Quaesitor's primary LLM backend is NVIDIA NIM, which is free and hosts a
broad catalogue of open models (Llama, Mistral, DeepSeek, Qwen, …). However,
NIM has real failure modes the project needs to survive:

- Per-key rate limits (429) and brief outages (503) during peak hours.
- A single model being temporarily unavailable (404) inside the 6-model
  smart fallback chain.
- The whole NIM service degrading during incident windows.

Users running self-hosted instances may also have paid credits with OpenAI
or Anthropic, or run a local Ollama server for air-gapped use. We needed a
router that uses the cheapest available provider first and only escalates
to paid/local options when the prior one fails.

## Decision
Implement a cross-provider router in `src/lib/llm-providers/index.ts` with
`smartWithFallback()` / `fastWithFallback()`:

1. `LLM_PROVIDER=auto` (default) tries providers in the fixed order
   **NVIDIA → OpenAI → Anthropic → Ollama**, skipping any provider whose
   required env var (`NVIDIA_API_KEY`, `OPENAI_API_KEY`,
   `ANTHROPIC_API_KEY`, `OLLAMA_URL`) is unset.
2. Each provider implements the same `LLMProviderInterface`
   (`isAvailable`, `smart`, `fast`), so the router is provider-agnostic.
3. If a provider throws, the router logs a structured warning
   (`module: "llm-router"`, `provider`, `err`) and moves to the next.
4. If `LLM_PROVIDER` is set to an explicit name, no cross-provider
   fallback happens — useful for users who want predictable billing.

The within-NVIDIA 6-model fallback chain (`llm-provider.ts`) still runs
before the router escalates to OpenAI, so we get model-level resilience
*and* provider-level resilience layered together.

## Consequences
**Pros**
- Free tier first keeps self-hosted operating cost at $0 for the common
  case.
- A single NIM outage no longer takes the product down.
- Ollama as the last hop enables fully air-gpped operation once a model
  is downloaded.
- Explicit `LLM_PROVIDER` opt-out preserves predictable billing for users
  who want it.

**Cons**
- Different providers have different token accounting, so cost reporting
  has to normalise (the `costPer1MTokens` field per provider).
- Streaming behaviour differs slightly between providers; the adapter
  classes absorb most of it but edge cases exist.
- Latency on a hard NIM failure is now `time(NVIDIA gives up) + time(OpenAI)`
  instead of just `time(NVIDIA gives up)` — the within-NVIDIA retry has to
  be tight to avoid compounding.

## Alternatives considered
- **Single provider only.** Rejected — NIM outages were causing user-visible
  failures.
- **OpenAI first (paid) for guaranteed quality.** Rejected — would eliminate
  the "$0 to run" property that drives adoption.
- **Round-robin between configured providers.** Rejected — destroys the
  cost ordering and makes per-provider rate-limit diagnosis harder.
- **User picks the provider per request.** Rejected — too much surface
  area for the chat UI; auto mode handles 95% of cases correctly.
