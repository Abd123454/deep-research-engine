# ADR-0004: Memory System with 5 Layers and LIKE Search Fallback

## Status
Accepted (2026-07-16)

## Context
Quaesitor wants to remember user preferences and facts across sessions —
"the user is an electrical engineer", "the user prefers concise answers",
"the user's motor is a 3-phase 7.5 kW induction motor" — and inject the
relevant memories into the LLM's system prompt at the right time. Two
storage realities constrain the design (see ADR-0001):

- In Postgres mode we get `pgvector` cosine similarity search.
- In SQLite mode we have only `LIKE` keyword matching, no vector index.

We needed a single recall API that works on both backends, returns useful
results on either, and degrades gracefully when one path fails.

## Decision
Implement a single 5-layer memory model — `conversation`, `message`,
`long_term_memory`, `research_session`, `artifact` — with a unified recall
API in `src/lib/memory-recall.ts`:

1. **Vector path (Postgres + pgvector).** Embed the query, run
   `1 - (embedding <=> query::vector)` over `long_term_memories`,
   boost by `recencyBoost` (up to 1.5× for recent memories) and
   `accessBoost` (up to 1.3× for frequently-recalled memories), and
   return the top N by combined score.
2. **LIKE fallback (SQLite).** Tokenise the query, drop stop words,
   build `content LIKE ?` conditions for the top 5 keywords, score each
   row by fraction of keywords matched, apply the same recency/access
   boosts, and return the top N.
3. **Bounded blast radius.** Both paths are wrapped in try/catch; a
   failure (e.g. embeddings endpoint down) logs a structured warning
   and returns `[]`, never throws.
4. **Access accounting.** On every successful recall we increment
   `access_count` and update `last_accessed`, so the boost functions
   have signal.

Memory extraction (`memory-extractor.ts`) writes to the same
`long_term_memories` table via the same dual-mode pattern.

## Consequences
**Pros**
- The chat and research flows call a single `recallRelevantMemories()`
  regardless of backend, so callers stay simple.
- Even on SQLite, users get keyword-based recall that's good enough for
  short- and medium-term personalisation.
- Recency + access boosts naturally promote "the user just told me X"
  over stale facts.
- Graceful degradation: a broken embeddings API never crashes chat.

**Cons**
- LIKE search misses synonyms and paraphrases — "motor" doesn't recall
  a memory that says "induction machine".
- Two score functions to maintain; vector similarity and keyword-match
  scores aren't directly comparable, so cross-backend A/B is noisy.
- Access-count writes on every recall add write load (acceptable on
  Postgres, mild concern on SQLite WAL).

## Alternatives considered
- **pgvector-only (drop SQLite memory support).** Rejected — breaks the
  zero-setup dev story from ADR-0001.
- **Single store, no recency/access boosts.** Rejected — empirically
  surfaced obsolete memories above current-turn facts.
- **sqlite-vec for the SQLite path.** Rejected at the time — additional
  native dependency; LIKE is "good enough" for the dev fallback and we
  avoid the build complexity.
- **External vector DB (Pinecone, Weaviate).** Rejected — adds a service
  to operate; Postgres + pgvector already covers the production case.
