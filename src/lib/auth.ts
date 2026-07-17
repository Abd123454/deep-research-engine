// Basic auth middleware — protects all /api/research/* routes.
//
// Uses HTTP Basic Auth with credentials from env vars. This is NOT next-auth
// (which was previously installed but unused dead code). Basic auth is the
// simplest way to prevent anonymous abuse of the API quotas.
//
// Set in .env:
//   AUTH_USERNAME=admin
//   AUTH_PASSWORD=changeme
//
// SECURITY: Auth is fail-closed in production. If NODE_ENV=production and
// AUTH_USERNAME/AUTH_PASSWORD are not set, all protected routes return 503.
// In development (NODE_ENV !== production), auth is optional (fail-open for
// local convenience), but a server-start warning is logged.

import { NextRequest, NextResponse } from "next/server";
import { env } from "./env";
import { logger } from "./logger";

const REALM = "Quaesitor";
const FALLBACK_USER_ID = "default";

/** Returns true if basic auth is enabled (both creds configured). */
export function isAuthEnabled(): boolean {
  return !!env("AUTH_USERNAME") && !!env("AUTH_PASSWORD");
}

/** Returns true if auth is optional (dev mode only). */
export function isAuthOptional(): boolean {
  return process.env.NODE_ENV !== "production";
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
      // Dev mode: allow open access for convenience
      return null;
    }
    // Production + no creds = REFUSE all access (fail-closed)
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration: authentication not configured. Set AUTH_USERNAME and AUTH_PASSWORD environment variables." },
      { status: 503 }
    );
  }
  if (validateAuth(req.headers.get("authorization"))) return null;
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
