// GET  /api/keys — list the caller's API keys (masked, never raw).
// POST /api/keys — create a new API key. Returns the raw key ONCE.
//
// P1 developer-platform feature. Keys are SHA-256 hashed at rest — the
// raw key is returned to the caller exactly ONCE at creation time and
// is unrecoverable after. The listing endpoint returns a masked prefix
// ("qaesitor_••••") so the user can identify which key is which without
// exposing the secret.
//
// Auth: uses `requireAuth` + `getUserId` (NOT `requireApiKey`) — these
// routes are part of the dashboard UI, not the public /api/v1/* API.
// Requiring API-key auth here would create a chicken-and-egg: you need
// a key to create a key.
import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getDb } from "@/lib/db";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { sanitizeError } from "@/lib/sanitize-error";
import { logger } from "@/lib/logger";

// Key format: `qaesitor_${24 random bytes as base64url}` ≈ 32 chars
// of entropy after the prefix. base64url is URL-safe (no `+` / `/` / `=`)
// so the key works cleanly in `Bearer` headers without escaping.
const API_KEY_PREFIX = "qaesitor_";
const KEY_ENTROPY_BYTES = 24;

/**
 * Build the masked prefix shown in the listing UI. We expose the
 * `qaesitor_` prefix + the first 4 chars of the random body + a
 * trailing `••••` so the user can visually distinguish two keys
 * created with different `name` values without seeing enough to
 * reconstruct the secret.
 *
 * Example: `qaesitor_abc123...` → `qaesitor_abc1••••`
 */
function maskKeyPrefix(rawKey: string): string {
  // rawKey starts with "qaesitor_" — show the prefix + first 4 chars
  // of the body + a bullet tail.
  const body = rawKey.slice(API_KEY_PREFIX.length);
  const head = body.slice(0, 4);
  return `${API_KEY_PREFIX}${head}••••`;
}

/**
 * Lazily create the `api_keys` table if it doesn't exist. The table is
 * also created eagerly by `initSqliteSchema` (src/lib/db.ts) — this is
 * defense-in-depth for fresh DBs that were never migrated.
 */
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

interface ApiKeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

/**
 * Build the safe response object for a key. NEVER includes the raw key
 * or the `key_hash` (the hash is not a secret per se, but exposing it
 * would let an attacker brute-force offline if they later obtained a
 * candidate raw key).
 */
function toResponseKey(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name,
    // The masked prefix as stored at creation time. e.g. "qaesitor_abc1••••".
    keyPrefix: row.key_prefix,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

// ---------- GET /api/keys ----------

export async function GET(req: NextRequest) {
  // These routes use Basic auth (dashboard UI) — NOT API-key auth.
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);

  try {
    ensureApiKeysTable();
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT id, user_id, key_hash, key_prefix, name, last_used_at, created_at, expires_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC"
      )
      .all(userId) as ApiKeyRow[];

    return NextResponse.json({
      keys: rows.map(toResponseKey),
      total: rows.length,
    });
  } catch (err) {
    logger.error(
      { module: "api-keys", err: sanitizeError(err), userId },
      "Failed to list API keys"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to list API keys." },
      { status: 500 }
    );
  }
}

// ---------- POST /api/keys ----------

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);

  // Parse body — { name: string }. Reject empty / overlong names.
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON." },
      { status: 400 }
    );
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Key name is required." },
      { status: 400 }
    );
  }
  if (name.length > 100) {
    return NextResponse.json(
      { ok: false, error: "Key name must be 100 characters or fewer." },
      { status: 400 }
    );
  }

  // Generate the raw key. base64url produces URL-safe chars (A-Z, a-z,
  // 0-9, -, _) so the key works cleanly in `Bearer` headers.
  const rawKey = `${API_KEY_PREFIX}${crypto
    .randomBytes(KEY_ENTROPY_BYTES)
    .toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = maskKeyPrefix(rawKey);
  const id = crypto.randomUUID();

  try {
    ensureApiKeysTable();
    const db = getDb();
    db.prepare(
      "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run(id, userId, keyHash, keyPrefix, name);

    // Audit log — `apikey.create`. The `key_prefix` is included so the
    // audit trail can identify WHICH key was created without exposing
    // the raw key. The raw key is NEVER logged.
    logSensitiveAction("apikey.create", userId, req, {
      keyId: id,
      keyPrefix,
      name,
    });

    logger.info(
      { module: "api-keys", userId, keyId: id, keyPrefix },
      "API key created"
    );

    // Return the raw key EXACTLY ONCE. The caller MUST persist it —
    // it is unrecoverable. The response shape mirrors the listing
    // shape (minus the masked prefix which is replaced by the raw key
    // here) so the UI can swap one for the other when transitioning
    // from "just created" to "stored" state.
    return NextResponse.json(
      {
        ok: true,
        key: {
          id,
          name,
          // Raw key — shown ONCE. The caller is responsible for
          // persisting it; we never return it again.
          key: rawKey,
          keyPrefix,
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
          expiresAt: null,
        },
        warning:
          "This is the only time the raw key will be shown. Store it securely — it cannot be recovered.",
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error(
      { module: "api-keys", err: sanitizeError(err), userId },
      "Failed to create API key"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to create API key." },
      { status: 500 }
    );
  }
}
