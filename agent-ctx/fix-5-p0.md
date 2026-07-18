# Task fix-5-p0 — Fix 5 Critical P0 Bugs

**Agent:** fix-5-p0
**Status:** In Progress
**Scope:** P0-1 ArtifactsPanel mount, P0-2 MAX_TOOL_ITERATIONS unify, P0-3 pgvector migration, P0-4 Sidebar wiring, P0-5 Streaming artifact detection.

## Plan

1. P0-2: Create `src/lib/swarm-constants.ts` exporting `MAX_TOOL_ITERATIONS = 15`. Import in `swarm.ts` (remove local) and `chat/agent/route.ts` (change local 5 → import).
2. P0-3: Uncomment `embedding Unsupported("vector(1536)")?` in Prisma schema. Create `src/lib/pgvector-migration.ts` that runs `CREATE EXTENSION IF NOT EXISTS vector` + `ALTER TABLE ... ADD COLUMN embedding vector(1536)` for `long_term_memories`, `messages`, `documents` when Postgres is configured. Document the SQLite fallback.
3. P0-4: Existing `/api/chat/conversations` route already returns conversations. In `UnifiedInterface.tsx`, fetch on mount, pass to Sidebar, refresh after sending.
4. P0-5: Add `detectArtifactStream(partialText)` to artifact-detector.ts (sliding window of last 500 chars). Wire ChatCard to call it throttled (200ms) during streaming, show "Artifact detected →" button.
5. P0-1: Add `activeArtifact` state to UnifiedInterface, render `ArtifactsPanel` as 3rd column.

## Notes for downstream agents

- `MAX_TOOL_ITERATIONS` is now exported from `src/lib/swarm-constants.ts`. Import it instead of redefining.
- pgvector migration is lazy — runs on first memory-recall use, not at startup, to avoid blocking boot.
- Sidebar conversations are fetched client-side in UnifiedInterface; the route uses `getUserId(req)` for multi-tenant isolation.
- Streaming artifact detection is throttled to 200ms in ChatCard; final detection runs on completion.

## Status: ✅ Complete

All 5 P0 fixes implemented and verified.

### Verification

```
bunx tsc --noEmit --strict   → 0 errors
bun run lint                  → 0 errors (6 pre-existing warnings)
bun run test                  → 447 passed (33 files)
```

### Summary of Changes

**P0-1 — ArtifactsPanel mounted as 3rd column**
- `UnifiedInterface.tsx`: `activeArtifact` state, `<ArtifactsPanel>` rendered conditionally on the right.
- `ChatCard` receives `onArtifact={handleArtifactChange}`.

**P0-2 — MAX_TOOL_ITERATIONS unified**
- New `src/lib/swarm-constants.ts` exporting `= 15`.
- `swarm.ts` imports + re-exports; `chat/agent/route.ts` imports (was `= 5`).

**P0-3 — pgvector migration enabled**
- Prisma schema: `embedding Unsupported("vector(1536)")?` uncommented on `Message`, `LongTermMemory`, `DocumentRecord`.
- New `src/lib/pgvector-migration.ts`: `ensurePgvector()` runs `CREATE EXTENSION vector` + `ALTER TABLE ... ADD COLUMN embedding vector(1536)` + ivfflat indexes. Lazy + idempotent. No-op on SQLite.
- `memory-recall.ts` calls `await ensurePgvector()` before the cosine-similarity query.

**P0-4 — Sidebar wired to conversations API**
- Conversations route uses `getUserId(req)` (multi-tenant safe).
- `UnifiedInterface` fetches on mount, refreshes 800ms after each send, passes to Sidebar with `activeId`.
- `SidebarConversation.type` made optional (conversations table has no type column).

**P0-5 — Streaming artifact detection**
- New `detectArtifactStream(partialText)` in `artifact-detector.ts`: sliding window (last 500 chars), conservative opening-marker detection.
- `ChatCard` calls it throttled (200ms) during streaming; renders "Artifact detected →" button when an opening marker is found.
- On stream completion, runs canonical `detectArtifact` and notifies parent with the final version.

### Notes for Downstream Agents

- `MAX_TOOL_ITERATIONS` lives in `src/lib/swarm-constants.ts` — import from there.
- `ensurePgvector()` is lazy and idempotent — call it from any new cosine-similarity code path.
- Streaming artifact detection is throttled to 200ms; if you wire it into another card, use the same throttle.
- Conversation selection is minimal (renders first assistant message as a LoadedSession); full multi-message rendering is deferred.
