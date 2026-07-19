// Basic auth middleware — protects all /api/research/* routes.
//
// Uses HTTP Basic Auth with credentials from env vars. This is NOT next-auth
// (which was previously installed but unused dead code). Basic auth is the
// simplest way to prevent anonymous abuse of the API quotas.
//
// Set in .env:
//   AUTH_USERNAME=admin
//   AUTH_PASSWORD=changeme
//   AUTH_DEV_BYPASS=1   # optional — only for local dev (C-4 fix)
//
// SECURITY: Auth is fail-closed in production. If AUTH_USERNAME/AUTH_PASSWORD
// are not set, all protected routes return 503. The ONLY way to bypass auth
// is to set AUTH_DEV_BYPASS=1 explicitly — this works in ANY environment
// (including preview deploys) so it must be used with care and never set on
// shared/public deployments.

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { env } from "./env";
import { logger } from "./logger";
import { getDb } from "./db";
import { getClientIP } from "./rate-limit";

const REALM = "Quaesitor";
const FALLBACK_USER_ID = "default";

/** Returns true if basic auth is enabled (both creds configured). */
export function isAuthEnabled(): boolean {
  return !!env("AUTH_USERNAME") && !!env("AUTH_PASSWORD");
}

/**
 * Returns true if auth is optional.
 *
 * C-4 (CVSS 8.2): previously this returned `true` whenever
 * `NODE_ENV !== "production"`, which meant every preview deploy
 * (Vercel preview, staging, QA) was completely open. Now auth is
 * only bypassed with an EXPLICIT flag — never auto-bypassed based
 * on NODE_ENV. Set `AUTH_DEV_BYPASS=1` to opt in (local dev only).
 */
export function isAuthOptional(): boolean {
  return process.env.AUTH_DEV_BYPASS === "1";
}

/** Validates a Basic auth header against env credentials. */
function validateAuth(header: string | null): boolean {
  if (!header || !header.startsWith("Basic ")) return false;
  const encoded = header.slice(6);
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  // Constant-time comparison to prevent timing attacks.
  const expectedUser = env("AUTH_USERNAME");
  const expectedPass = env("AUTH_PASSWORD");
  return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass);
}

/**
 * Resolve the current user's identifier from a request.
 *
 * Multi-tenant safety: when Basic auth is configured, the userId is the
 * validated AUTH_USERNAME from the request's Authorization header. When
 * auth is NOT configured (dev/no-auth mode), falls back to "default" and
 * logs a one-shot warning so production deployments are noisy about it.
 *
 * This replaces the previous `userId = "default"` pattern that allowed
 * user A to read user B's billing portal / data.
 *
 * IMPORTANT: this does NOT enforce auth — it only resolves an identity.
 * Pair with `requireAuth(req)` when the route needs to refuse anonymous
 * access.
 */
export function getUserId(req: NextRequest): string {
  if (isAuthEnabled()) {
    const header = req.headers.get("authorization");
    if (validateAuth(header)) {
      // AUTH_USERNAME is the source of truth — never trust a client-supplied
      // username that wasn't validated against the password.
      return env("AUTH_USERNAME");
    }
    // Auth configured but header missing/invalid → anonymous bucket.
    // Callers should usually `requireAuth` first; here we still isolate
    // the unknown caller from the "default" tenant to avoid cross-tenant
    // leakage if they reach this branch.
    return `anon:${FALLBACK_USER_ID}`;
  }
  // Auth not configured. Single-tenant dev mode.
  logger.warn(
    { module: "auth" },
    "Auth not configured — using fallback userId 'default'. Set AUTH_USERNAME/AUTH_PASSWORD to enable multi-tenant isolation."
  );
  return FALLBACK_USER_ID;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Middleware-style guard for API routes. Returns null if OK, or a 401/503 response. */
export function requireAuth(req: NextRequest): NextResponse | null {
  // Fail-closed in production if auth not configured
  if (!isAuthEnabled()) {
    if (isAuthOptional()) {
      // Explicit opt-in bypass (AUTH_DEV_BYPASS=1). Local dev only —
      // C-4 fix: previously this was an implicit NODE_ENV check that left
      // every preview deploy completely open.
      return null;
    }
    // Production + no creds = REFUSE all access (fail-closed)
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: authentication not configured. Set AUTH_USERNAME and AUTH_PASSWORD environment variables." },
      { status: 503 }
    );
  }
  if (!validateAuth(req.headers.get("authorization"))) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
        },
      }
    );
  }

  // MFA enforcement: when MFA_REQUIRED=true (enterprise deployments), the
  // request must also carry a valid X-MFA-Token header. The token is verified
  // against the user's per-user MFA secret stored in the `user_mfa` table.
  // In dev/basic deployments (MFA_REQUIRED not set), MFA is optional and
  // routes work with just Basic Auth.
  if (process.env.MFA_REQUIRED === "true") {
    const mfaToken = req.headers.get("x-mfa-token");
    if (!mfaToken) {
      return NextResponse.json(
        { ok: false, error: "MFA token required. Provide X-MFA-Token header." },
        { status: 401 }
      );
    }
    // H-8 (CVSS 5.0): previously read a single shared `process.env.MFA_SECRET`
    // for ALL users — meaning every user shared the same TOTP seed.
    // `getUserMfaSecret(userId)` resolves the per-user secret from the
    // `user_mfa` table, with a backward-compat fallback to the env var
    // for single-user deployments that haven't migrated yet.
    const userId = getUserId(req);
    // Lazy-load to avoid pulling crypto into client bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getUserMfaSecret, verifyTotp } = require("./mfa");
    const mfaSecret = getUserMfaSecret(userId);
    if (!mfaSecret) {
      return NextResponse.json(
        { ok: false, error: "MFA is required but no MFA secret is configured for this user. Set up MFA via /api/auth/mfa/setup or set MFA_SECRET." },
        { status: 503 }
      );
    }
    if (!verifyTotp(mfaToken, mfaSecret)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired MFA token." },
        { status: 401 }
      );
    }
  }

  return null;
}

/**
 * Routes that expose sensitive admin/operational tooling. These are gated
 * by `requireAdminAccess` in addition to `requireAuth` so operators can
 * further restrict them to a known IP allowlist (e.g. corporate NAT or
 * bastion hosts) even when auth credentials have been issued.
 */
const ADMIN_ROUTES = ["/api/mcp", "/api/audit-logs"];

/**
 * IP allowlist guard for sensitive admin routes.
 *
 * If `ADMIN_IP_ALLOWLIST` is unset (the default), this function is a no-op:
 * admin routes fall back to whatever `requireAuth` enforces (Basic Auth in
 * production, open in dev). This preserves existing behavior.
 *
 * If `ADMIN_IP_ALLOWLIST` is set (comma-separated IPs/CIDRs — CIDR matching
 * is intentionally NOT implemented; only exact IP string match is supported
 * to keep the surface minimal), the client IP (resolved via the shared
 * `getClientIP()` helper, which respects TRUSTED_PROXY_HOPS so an attacker
 * can't spoof the X-Forwarded-For header to bypass the allowlist) must
 * appear in the allowlist. Otherwise a 403 is returned.
 *
 * Call this BEFORE `requireAuth` in admin route handlers so the allowlist
 * check fires even when no credentials are sent (defense in depth):
 *
 *   const adminFail = requireAdminAccess(req);
 *   if (adminFail) return adminFail;
 *   const authFail = requireAuth(req);
 *   if (authFail) return authFail;
 *
 * NOTE: CIDR matching is not implemented — operators should list explicit
 * IPs or use a reverse proxy (Caddy/Nginx) to normalize egress IPs. This
 * matches the audit's exact-string-match recommendation.
 */
export function requireAdminAccess(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;
  if (!ADMIN_ROUTES.some((r) => path.startsWith(r))) return null;

  // No allowlist configured = defer to auth (existing behavior).
  const allowlist = process.env.ADMIN_IP_ALLOWLIST;
  if (!allowlist) return null;

  // H-3: use getClientIP() instead of reading X-Forwarded-For directly.
  // The admin IP allowlist is a security decision — spoofable XFF would
  // let an attacker bypass the allowlist by sending a fake XFF header.
  const clientIp = getClientIP(req);

  const allowed = allowlist
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowed.includes(clientIp)) {
    return NextResponse.json(
      { ok: false, error: "Admin access denied from this IP address." },
      { status: 403 }
    );
  }
  return null;
}

// ---------- API key auth (developer platform) ----------
//
// P1 feature: programmatic API access via `Bearer qaesitor_...` tokens.
// The /api/v1/* namespace uses `requireApiKey` instead of `requireAuth`.
// Keys are SHA-256 hashed at rest — the raw key is shown to the caller
// exactly once at creation time (see POST /api/keys) and is unrecoverable.
//
// The key format is `qaesitor_${randomBytes(24).toString("base64url")}`
// (~32 chars of entropy after the prefix). The prefix `qaesitor_` is what
// we sniff for in the Authorization header before hashing — it lets us
// distinguish an API-key request from a Basic-auth request without
// parsing the credential payload.

const API_KEY_PREFIX = "qaesitor_";
const API_KEY_BEARER_PREFIX = `Bearer ${API_KEY_PREFIX}`;

/**
 * Lazily create the `api_keys` table if it doesn't exist. This is called
 * from `requireApiKey` so the public-API namespace keeps working even on
 * a fresh database that was never migrated. The table is also created
 * eagerly by `initSqliteSchema` (see src/lib/db.ts) — this is just
 * defense-in-depth.
 */
function ensureApiKeysTable(): void {
  try {
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
  } catch (err) {
    // Fail-soft — if the table can't be created (read-only FS, etc.),
    // the lookup below will throw and the caller gets a 500. We log
    // here so the operator sees the underlying error.
    logger.warn(
      { module: "auth", err: err instanceof Error ? err.message : String(err) },
      "Failed to ensure api_keys table exists"
    );
  }
}

/**
 * Validate a `Bearer qaesitor_...` Authorization header against the
 * `api_keys` table. Returns the resolved `{ userId }` on success, or a
 * 401/500 `NextResponse` on failure.
 *
 * On success, the key's `last_used_at` column is updated (best-effort —
 * a failure to update the timestamp does NOT block the request).
 *
 * SECURITY: the lookup is by SHA-256 hash, never by raw key. The raw key
 * is not stored anywhere — not in the DB, not in logs, not in metrics.
 * Constant-time comparison is unnecessary here because the lookup is via
 * a hash index (the DB's own B-tree compare is not timing-sensitive in a
 * way that leaks the hash).
 *
 * Use this in /api/v1/* routes INSTEAD of `requireAuth`:
 *
 *   const apiAuth = requireApiKey(req);
 *   if (apiAuth instanceof NextResponse) return apiAuth;
 *   const userId = apiAuth.userId;
 */
export function requireApiKey(
  req: NextRequest
): { userId: string } | NextResponse {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith(API_KEY_BEARER_PREFIX)) {
    return NextResponse.json(
      {
        ok: false,
        error: "API key required. Use 'Bearer qaesitor_...'.",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="Quaesitor API"',
        },
      }
    );
  }

  const rawKey = authHeader.slice(API_KEY_BEARER_PREFIX.length);

  // Defensive: a header that starts with the prefix but has no key body
  // is treated as missing (401, not 500).
  if (!rawKey) {
    return NextResponse.json(
      { ok: false, error: "API key required. Use 'Bearer qaesitor_...'." },
      { status: 401 }
    );
  }

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  try {
    ensureApiKeysTable();
    const db = getDb();
    const row = db
      .prepare(
        "SELECT user_id FROM api_keys WHERE key_hash = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
      )
      .get(keyHash) as { user_id: string } | undefined;

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired API key." },
        { status: 401 }
      );
    }

    // Best-effort: stamp `last_used_at`. A failure here MUST NOT block
    // the request — we already verified the key. Logged at warn level
    // so a misbehaving DB shows up in ops dashboards without breaking
    // the API call.
    try {
      db.prepare(
        "UPDATE api_keys SET last_used_at = datetime('now') WHERE key_hash = ?"
      ).run(keyHash);
    } catch (err) {
      logger.warn(
        { module: "auth", err: err instanceof Error ? err.message : String(err) },
        "Failed to update api_keys.last_used_at"
      );
    }

    return { userId: row.user_id };
  } catch (err) {
    logger.error(
      { module: "auth", err: err instanceof Error ? err.message : String(err) },
      "API key validation failed (DB error)"
    );
    return NextResponse.json(
      { ok: false, error: "API key validation failed." },
      { status: 500 }
    );
  }
}

/**
 * Constant-time string comparison. Re-exported for tests that want to
 * verify the auth module's internal helper. Not part of the public API.
 */
export function _timingSafeEqual(a: string, b: string): boolean {
  return timingSafeEqual(a, b);
}
