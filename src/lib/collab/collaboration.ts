// Real-time collaboration — high-level session + cursor/presence interface.
//
// p2-soc2-launch / Feature 2: This module is a companion to
// `collab-server.ts`. The existing `collab-server.ts` provides the
// session REGISTRY used by the HTTP API (`/api/collab/[sessionId]`) —
// create / join / leave / inspect. This module adds the higher-level
// primitives a Canvas Mode client would need:
//
//   - `CollabSession` with `cursorPositions` (live cursor sharing)
//   - `CollabUpdate` discriminated union (cursor / edit / presence / comment)
//   - `updateCursor()` for live cursor sharing
//   - `getActiveSessions()` for "who's online" admin views
//
// STUB: The functions exist, the types are correct, and `updateCursor`
// mutates the in-memory session so the interface is exercised, but the
// cursor positions are NOT broadcast to other participants (no
// WebSocket fan-out). The full implementation requires the `yjs` +
// `y-websocket` packages (not yet in package.json) plus a y-websocket
// mini-service (see `mini-services/` pattern). The next milestone wires
// up the mini-service that will broadcast `CollabUpdate` events to all
// participants in real time.

/**
 * A collaboration session with live cursor + presence state.
 *
 * NOTE: `cursorPositions` is a `Map`, which is NOT serializable to
 * JSON. Callers that need to send a session over the wire (e.g. an
 * HTTP response) must convert the Map to a plain object first.
 */
export interface CollabSession {
  /** Server-generated UUID — the WebSocket room name + the API resource id. */
  id: string;
  /** The document being collaborated on (research job id, conversation id, etc.). */
  documentId: string;
  /** userIds of active participants. The first entry is the owner. */
  participants: string[];
  /** Live cursor positions, keyed by userId. */
  cursorPositions: Map<string, { x: number; y: number; color: string }>;
  /** ISO timestamp — last mutation (cursor move, join, leave). */
  lastUpdate: string;
}

/**
 * A real-time update broadcast to session participants.
 *
 * Discriminated union — the `type` field selects the shape of `data`:
 *   - "cursor"   → { x: number, y: number }
 *   - "edit"     → CRDT update (opaque binary / JSON for now; yjs would
 *                  use `Uint8Array` here)
 *   - "presence" → { status: "active" | "idle" | "away" }
 *   - "comment"  → { text: string, anchor?: { x: number, y: number } }
 *
 * The full y-websocket implementation will serialize this as a binary
 * frame; the stub interface is JSON-only.
 */
export interface CollabUpdate {
  type: "cursor" | "edit" | "presence" | "comment";
  userId: string;
  data: unknown;
  timestamp: string;
}

// ---- Warm color palette for cursor labels ----
// Quaesitor's design values — saddle browns and warm ambers. Each
// participant gets a deterministic color from this list (see
// `updateCursor` below). The palette has 5 colors, so up to 5
// participants get distinct colors; the 6th wraps around (still
// distinguishable because their initials differ).
const CURSOR_COLORS = [
  "#8b4513", // saddle brown (primary)
  "#a37a3f", // warm bronze
  "#5a5044", // muted ink
  "#6b6358", // faded ink
  "#9b6b5c", // terracotta
] as const;

// In-memory session registry. Production would use Redis so multiple
// Node processes (and the y-websocket mini-service) can share state.
const sessions = new Map<string, CollabSession>();

/**
 * Create a new collaboration session for a document.
 *
 * The session id is a server-generated UUID — share it with
 * collaborators so they can join via `joinSession(id, theirUserId)`.
 * The owner is added as the first participant via a follow-up
 * `joinSession` call (this matches the spec's signature, which takes
 * only `documentId`).
 */
export function createSession(documentId: string): CollabSession {
  const session: CollabSession = {
    id: crypto.randomUUID(),
    documentId,
    participants: [],
    cursorPositions: new Map(),
    lastUpdate: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  return session;
}

/**
 * Look up a session by id. Returns `null` if not found.
 *
 * The session's `cursorPositions` Map is live — mutating it (e.g. via
 * `updateCursor`) immediately reflects in the session returned by the
 * next `getSession` call (they reference the same Map object).
 */
export function getSession(sessionId: string): CollabSession | null {
  return sessions.get(sessionId) ?? null;
}

/**
 * Join an existing session. Idempotent — if the user is already a
 * participant, this just refreshes `lastUpdate` (no duplicate entry).
 *
 * @returns the updated session, or `null` if no session with that id exists.
 */
export function joinSession(
  sessionId: string,
  userId: string
): CollabSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (!session.participants.includes(userId)) {
    session.participants.push(userId);
  }
  session.lastUpdate = new Date().toISOString();
  return session;
}

/**
 * Leave a session. Removes the user from the participant list AND
 * clears their cursor position. When the last participant leaves, the
 * session is deleted (garbage-collected) so the registry doesn't grow
 * unbounded.
 */
export function leaveSession(sessionId: string, userId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.participants = session.participants.filter((p) => p !== userId);
  session.cursorPositions.delete(userId);
  session.lastUpdate = new Date().toISOString();
  if (session.participants.length === 0) {
    sessions.delete(sessionId);
  }
}

/**
 * Update a participant's cursor position. The cursor color is
 * deterministic per userId (`charCodeAt(0) % palette.length`) so the
 * same user always gets the same color across sessions — this matches
 * the `CollabIndicator` component's color-assignment logic.
 *
 * STUB: the full y-websocket implementation would ALSO broadcast this
 * update to all other participants via a `CollabUpdate` event of type
 * "cursor". The stub just mutates the local state.
 */
export function updateCursor(
  sessionId: string,
  userId: string,
  x: number,
  y: number
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  const color = CURSOR_COLORS[userId.charCodeAt(0) % CURSOR_COLORS.length];
  session.cursorPositions.set(userId, { x, y, color });
  session.lastUpdate = new Date().toISOString();
}

/**
 * List all active sessions. Used by admin tooling and the
 * `CollabIndicator`'s "who's online" view.
 *
 * NOTE: the returned `CollabSession` objects have a `cursorPositions`
 * Map — callers that need JSON-serializable output must convert it.
 */
export function getActiveSessions(): CollabSession[] {
  return Array.from(sessions.values());
}
