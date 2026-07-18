// DELETE /api/keys/[id] — revoke (soft-delete) an API key.
//
// Revocation is a hard DELETE — once revoked, the key's hash is gone
// and any in-flight requests presenting that key get 401 on the next
// `requireApiKey` call. We do NOT keep a "revoked" tombstone because:
//   1. There's no replay value — once the hash is deleted, the raw key
//      is just a 32-char string that no longer matches anything.
//   2. Storing revoked hashes would let an attacker who exfiltrates
//      the DB test candidate keys against the revoked set offline.
//
// Auth: Basic auth (dashboard UI). The route verifies that the key
// belongs to the caller before deleting — a user cannot revoke another
// user's key by guessing its id.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";

function ensureApiKeysTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      name TEXT NOT NULL,
      last_used_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      expires_at DATETIME
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Key id is required." },
      { status: 400 }
    );
  }

  try {
    ensureApiKeysTable();
    const db = getDb();

    // Fetch the row BEFORE deleting — we need (a) to verify ownership
    // and (b) the `key_prefix` for the audit log. Returning 404 (not
    // 403) when the key doesn't exist or belongs to another user
    // avoids leaking the existence of other users' key IDs.
    const row = db
      .prepare(
        "SELECT user_id, key_prefix, name FROM api_keys WHERE id = ?"
      )
      .get(id) as { user_id: string; key_prefix: string; name: string } | undefined;

    if (!row || row.user_id !== userId) {
      return NextResponse.json(
        { ok: false, error: "API key not found." },
        { status: 404 }
      );
    }

    db.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(
      id,
      userId
    );

    logSensitiveAction("apikey.delete", userId, req, {
      keyId: id,
      keyPrefix: row.key_prefix,
      name: row.name,
    });

    logger.info(
      { module: "api-keys", userId, keyId: id, keyPrefix: row.key_prefix },
      "API key revoked"
    );

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    logger.error(
      { module: "api-keys", err: sanitizeError(err), userId, keyId: id },
      "Failed to revoke API key"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to revoke API key." },
      { status: 500 }
    );
  }
}
