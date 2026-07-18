// /api/collab/[sessionId] — Real-time collaboration session lifecycle.
//
// P2-final-wave / Feature 2: HTTP API for the Yjs + WebSocket collab
// session registry. The actual Yjs document sync (CRDT updates over
// WebSocket) is handled by a separate y-websocket mini-service (planned
// for a future milestone); this route just manages the session registry
// (create / join / leave / inspect).
//
// Endpoints:
//   POST   /api/collab              — create a new session (owner = caller)
//   GET    /api/collab/:sessionId   — get session info (must be participant)
//   DELETE /api/collab/:sessionId   — leave the session (caller removes self)
//
// SECURITY:
//   1. requireAuth + getUserId — only the authenticated user can create /
//      join / leave / inspect sessions. Anonymous access is rejected.
//   2. GET + DELETE require that the caller is a participant — you can't
//      inspect or "leave" a session you're not part of. (POST/create is
//      open to any authenticated user — you're creating a NEW session
//      where you're the owner.)
//   3. Audit logging — every create / join / leave is recorded with the
//      `collab.session` action slug so an operator can reconstruct who
//      collaborated on what document and when.
//
// The route runs in the nodejs runtime (not edge) because the in-memory
// session registry uses `setInterval` for stale-session cleanup, which
// is not available in the edge runtime.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";
import {
  createSession,
  leaveSession,
  getSession,
} from "@/lib/collab/collab-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateSessionBody {
  documentId?: unknown;
}

/**
 * POST /api/collab[?XTransformPort=...] — create a new collaboration
 * session for a document.
 *
 * Body: `{ documentId: string }` — the id of the document (research job,
 * conversation, etc.) being collaborated on. Must be a non-empty string
 * ≤ 200 chars (defense-in-depth — a malicious caller could try to stuff
 * a huge blob into the registry).
 *
 * Response: `{ ok, session: CollabSession }` with the new session (the
 * caller is the owner / first participant). The session id is a
 * server-generated UUID — share it with collaborators so they can join.
 */
export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  let body: CreateSessionBody;
  try {
    body = (await req.json()) as CreateSessionBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Validate documentId — must be a non-empty string, ≤ 200 chars.
  const documentId = body.documentId;
  if (typeof documentId !== "string" || documentId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "'documentId' is required (non-empty string)." },
      { status: 400 }
    );
  }
  if (documentId.length > 200) {
    return NextResponse.json(
      { ok: false, error: "'documentId' must be ≤ 200 chars." },
      { status: 400 }
    );
  }

  // Audit-log the session creation. The documentId is recorded so an
  // operator reviewing the audit trail can correlate sessions to
  // documents. The session id isn't known yet (it's generated inside
  // createSession), but the userId + documentId are the stable identifiers.
  logSensitiveAction("collab.session", userId, req, {
    op: "create",
    documentId,
  });

  try {
    const session = createSession(documentId, userId);
    logger.debug(
      { module: "collab", userId, sessionId: session.id, documentId },
      "Collab session created"
    );
    return NextResponse.json({ ok: true, session });
  } catch (err) {
    logger.warn(
      { module: "collab", userId, documentId, err: sanitizeError(err) },
      "Collab session creation failed"
    );
    return NextResponse.json(
      { ok: false, error: sanitizeError(err) || "Failed to create session." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collab/:sessionId — get session info.
 *
 * Requires that the caller is a participant (owner or joined collaborator).
 * This prevents a user from enumerating other users' collaboration sessions
 * by guessing session ids.
 *
 * Response: `{ ok, session: CollabSession }` or 404 if not found / 403
 * if the caller isn't a participant.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "Missing sessionId." },
      { status: 400 }
    );
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Session not found." },
      { status: 404 }
    );
  }

  // Authorization: only participants can inspect a session.
  if (!session.participants.includes(userId)) {
    return NextResponse.json(
      { ok: false, error: "Not a participant in this session." },
      { status: 403 }
    );
  }

  // Audit-log the inspection. This is a read, but the participant list
  // is sensitive (it reveals who's collaborating on what), so we log it.
  logSensitiveAction("collab.session", userId, req, {
    op: "inspect",
    sessionId,
    participantCount: session.participants.length,
  });

  return NextResponse.json({ ok: true, session });
}

/**
 * DELETE /api/collab/:sessionId — leave the session.
 *
 * The caller removes THEMSELF from the participant list. They cannot
 * remove other participants (only the owner can, via a future admin
 * endpoint). When the last participant leaves, the session is
 * garbage-collected by the registry.
 *
 * Response: `{ ok: true }` or 404 if not found. Idempotent — leaving a
 * session you're not part of is a no-op (still returns 200).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;
  const userId = getUserId(req);

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "Missing sessionId." },
      { status: 400 }
    );
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Session not found." },
      { status: 404 }
    );
  }

  // Audit-log the leave BEFORE mutating so even a failed leave is recorded.
  logSensitiveAction("collab.session", userId, req, {
    op: "leave",
    sessionId,
    wasParticipant: session.participants.includes(userId),
  });

  leaveSession(sessionId, userId);

  logger.debug(
    { module: "collab", userId, sessionId },
    "User left collab session"
  );

  return NextResponse.json({ ok: true });
}
