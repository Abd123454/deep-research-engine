// POST /api/artifacts/storage — persistent key-value storage for artifacts.
// Implements the window.storage API pattern from Claude Fable 5.
//
// Limits:
// - Key: up to 200 chars
// - Value: up to 5MB per key
// - Last write wins
// - Shared (cross-user) or personal scope

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getUserId, requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_KEY_LENGTH = 200;
const MAX_VALUE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  let body: { action?: string; key?: string; value?: string; shared?: boolean; prefix?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Refuse anonymous access when auth is configured.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  // SECURITY: resolve userId from auth (was hardcoded "default").
  const userId = getUserId(req);
  const { action, key, value, shared = false, prefix } = body;

  if (!action) return NextResponse.json({ error: "Action required" }, { status: 400 });

  try {
    const db = getDb();

    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS artifact_storage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        shared INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, key, shared)
      )
    `);

    switch (action) {
      case "get": {
        if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });
        const row = db.prepare(
          "SELECT value FROM artifact_storage WHERE user_id = ? AND key = ? AND shared = ?"
        ).get(userId, key, shared ? 1 : 0) as { value: string | null } | undefined;
        return NextResponse.json({ key, value: row?.value ?? null, shared });
      }

      case "set": {
        if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });
        if (key.length > MAX_KEY_LENGTH) return NextResponse.json({ error: "Key too long (max 200 chars)" }, { status: 400 });
        if (value && value.length > MAX_VALUE_SIZE) return NextResponse.json({ error: "Value too large (max 5MB)" }, { status: 413 });

        db.prepare(`
          INSERT INTO artifact_storage (id, user_id, key, value, shared, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(user_id, key, shared) DO UPDATE SET value = ?, updated_at = datetime('now')
        `).run(crypto.randomUUID(), userId, key, value || "", shared ? 1 : 0, value || "");

        logger.info({ userId, key, shared, action: "set" }, "Artifact storage set");
        return NextResponse.json({ key, value, shared, saved: true });
      }

      case "delete": {
        if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });
        db.prepare("DELETE FROM artifact_storage WHERE user_id = ? AND key = ? AND shared = ?")
          .run(userId, key, shared ? 1 : 0);
        return NextResponse.json({ key, deleted: true, shared });
      }

      case "list": {
        const pattern = prefix ? `${prefix}%` : "%";
        const rows = db.prepare(
          "SELECT key FROM artifact_storage WHERE user_id = ? AND shared = ? AND key LIKE ? ORDER BY key"
        ).all(userId, shared ? 1 : 0, pattern) as { key: string }[];
        return NextResponse.json({ keys: rows.map((r) => r.key), prefix, shared });
      }

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    logger.error({ err, action, key }, "Artifact storage error");
    return NextResponse.json({ error: "Storage operation failed" }, { status: 500 });
  }
}
