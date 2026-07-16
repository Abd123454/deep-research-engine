# ADR-0002: Agent Cluster Design (7 Roles, Parallel Workers, Synthesis)

## Status
Accepted (2026-07-16)

## Context
The `/api/swarm` endpoint ("agent cluster") needs to produce a single
high-quality answer to a complex task that may span multiple domains
(e.g. "Design a secure ATS panel for a 3-phase motor with relay logic and
explain the OWASP risks of its remote monitoring interface"). A single
general-purpose LLM call tends to be shallow on every sub-domain. We
needed a multi-agent architecture that:

- Decomposes the task into independent, parallelisable subtasks.
- Routes each subtask to a specialist with the right tools and prompt.
- Combines the partial answers without just concatenating them.
- Streams progress to the client (SSE) so the user sees activity.

## Decision
Implement a three-stage pipeline in `src/lib/swarm.ts`:

1. **Orchestrator** (one `llm.fast` JSON call) breaks the task into 2–4
   subtasks, each tagged with a role from the closed set
   `{researcher, coder, analyst, writer, generalist, security_analyst,
   electrical_engineer}`.
2. **Workers** run in parallel via `Promise.allSettled`, each with a
   role-specific system prompt and a role-restricted tool set
   (`ROLE_TOOLS`). Each worker runs a 4-iteration ReAct loop with a 90 s
   timeout.
3. **Synthesizer** (one `llm.smart` streaming call) merges worker outputs
   into a single coherent markdown report, deduplicating and resolving
   contradictions rather than concatenating.

Failures are contained: if a worker crashes or times out, its slot is
replaced with an `(agent failed: …)` note and synthesis still runs.

## Consequences
**Pros**
- Parallelism keeps wall-clock latency close to a single slow call rather
  than `N` sequential calls.
- Specialist prompts materially improve depth on security and electrical
  engineering topics — the two domains we explicitly added roles for.
- The closed role set keeps the orchestrator prompt small and predictable.
- Streaming events (`agent_token`, `agent_tool`, `synth_token`) give the
  UI real-time feedback.

**Cons**
- More LLM calls per request (1 plan + N workers + 1 synth) → higher
  token cost and more failure modes.
- The role set is hard-coded; adding a new specialist requires editing
  `AgentRole`, `ROLE_PROMPTS`, `ROLE_TOOLS`, and the orchestrator prompt.
- Synthesis quality depends on workers producing compatible formats;
  sometimes the synthesizer has to reconcile conflicting facts.

## Alternatives considered
- **Single-agent with a long context window.** Rejected — empirically
  shallower on specialist topics, and provides no progress feedback.
- **Sequential pipeline (researcher → analyst → writer).** Rejected —
  wall-clock latency grows linearly with subtask count.
- **Dynamic role generation.** Rejected — unpredictable prompts make the
  orchestrator JSON unreliable; we keep a closed set with safe fallbacks.
- **Many more roles (10+).** Rejected — the orchestrator started emitting
  redundant subtasks just to use them; 7 is the sweet spot.
