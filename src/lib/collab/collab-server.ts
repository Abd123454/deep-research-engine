// Real-time collaboration via Yjs + WebSocket.
//
// P2-final-wave / Feature 2: this is the server-side Yjs document manager.
// It tracks collaboration sessions (a document + a participant list) in
// an in-memory registry. Production deployments would back this with
// Redis (for cross-process / multi-instance fan-out); the in-memory map
// is sufficient for single-process dev + small-team prod.
//
// The actual Yjs document sync (CRDT updates over WebSocket) is handled
// by a separate y-websocket mini-service (planned for a future milestone).
// This module provides the SESSION REGISTRY that the HTTP API
// (`/api/collab/[sessionId]`) uses to create / join / leave sessions and
// that the CollabIndicator component reads to render the participant list.
//
// Lifecycle:
//   1. createSession(documentId, userId) — owner opens a new session.
//      Returns the session (with the owner as the first participant).
//   2. joinSession(sessionId, userId) — a collaborator joins. Idempotent:
//      re-joining a session you're already in is a no-op (just refreshes
//      `lastActivity`).
//   3. leaveSession(sessionId, userId) — a participant leaves. When the
//      last participant leaves, the session is garbage-collected.
//   4. cleanupStaleSessions() — runs on a 5-minute interval (setInterval
//      with .unref() so it doesn't keep the Node process alive) and
//      evicts sessions with no activity for > 24h.
//
// SECURITY: every mutation is recorded with `lastActivity` so the
// CollabIndicator can show "active in the last N minutes". The registry
// is process-local — there's no cross-process sync. For multi-instance
// deployments, swap the `sessions` Map for a Redis-backed implementation
// (same interface, different storage).

export interface CollabSession {
  /** Server-generated UUID — the WebSocket room name + the API resource id. */
  id: string;
  /** The document being collaborated on (research job id, conversation id, etc.). */
  documentId: string;
  /** userIds of active participants. The first entry is the owner. */
  participants: string[];
  /** ISO timestamp — when the session was created. */
  createdAt: string;
  /** ISO timestamp — the last join / leave / heartbeat. Used for stale eviction. */
  lastActivity: string;
}

// In-memory session registry. Production would use Redis so multiple
// Node processes (and the y-websocket mini-service) can share state.
const sessions = new Map<string, CollabSession>();

/** Maximum idle time before a session is considered stale (24 hours). */
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

/** How often the stale-session sweeper runs (5 minutes). */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Create a new collaboration session for a document.
 *
 * The caller becomes the session owner (the first participant). The
 * session id is a server-generated UUID — share it with collaborators
 * so they can join via `joinSession(id, theirUserId)`.
 */
export function createSession(documentId: string, userId: string): CollabSession {
  const now = new Date().toISOString();
  const session: CollabSession = {
    id: crypto.randomUUID(),
    documentId,
    participants: [userId],
    createdAt: now,
    lastActivity: now,
  };
  sessions.set(session.id, session);
  return session;
}

/**
 * Join an existing session. Idempotent — if the user is already a
 * participant, this just refreshes `lastActivity` (no duplicate entry).
 *
 * @returns the updated session, or `null` if no session with that id exists.
 */
export function joinSession(sessionId: string, userId: string): CollabSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (!session.participants.includes(userId)) {
    session.participants.push(userId);
  }
  session.lastActivity = new Date().toISOString();
  return session;
}

/**
 * Leave a session. Removes the user from the participant list. When
 * the last participant leaves, the session is deleted (garbage-collected)
 * so the registry doesn't grow unbounded.
 */
export function leaveSession(sessionId: string, userId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.participants = session.participants.filter((p) => p !== userId);
  session.lastActivity = new Date().toISOString();
  if (session.participants.length === 0) {
    sessions.delete(sessionId);
  }
}

/**
 * Look up a session by id. Returns `null` if not found (or if it was
 * garbage-collected because the last participant left).
 */
export function getSession(sessionId: string): CollabSession | null {
  return sessions.get(sessionId) ?? null;
}

/**
 * List all active (non-stale) sessions. Used by admin tooling and the
 * CollabIndicator's "who's online" view. Stale sessions (> 24h idle)
 * are excluded — call `cleanupStaleSessions()` to actually evict them.
 */
export function getActiveSessions(): CollabSession[] {
  const now = Date.now();
  return Array.from(sessions.values()).filter(
    (s) => now - new Date(s.lastActivity).getTime() < MAX_SESSION_AGE_MS
  );
}

/**
 * Evict sessions with no activity for > 24h. Called automatically every
 * 5 minutes by the setInterval below; can also be called manually (e.g.
 * from a health-check endpoint that wants to report the post-cleanup
 * session count).
 *
 * @returns the number of sessions evicted.
 */
export function cleanupStaleSessions(): number {
  const now = Date.now();
  let removed = 0;
  for (const [id, session] of sessions) {
    if (now - new Date(session.lastActivity).getTime() > MAX_SESSION_AGE_MS) {
      sessions.delete(id);
      removed++;
    }
  }
  return removed;
}

// Auto-cleanup every 5 minutes. The timer is `.unref()`'d so it doesn't
// keep the Node process alive on its own (e.g. during graceful shutdown).
// In edge runtimes `setInterval` may be undefined — guard with typeof.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    cleanupStaleSessions();
  }, CLEANUP_INTERVAL_MS);
  if (timer && typeof timer.unref === "function") timer.unref();
}
