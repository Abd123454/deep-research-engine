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
// If both are empty, auth is DISABLED (open access) — suitable for local dev
// but NOT production. A warning is logged on server start.

import { NextRequest, NextResponse } from "next/server";
import { env } from "./env";

const REALM = "Cognis";

/** Returns true if basic auth is enabled (both creds configured). */
export function isAuthEnabled(): boolean {
  return !!env("AUTH_USERNAME") && !!env("AUTH_PASSWORD");
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Middleware-style guard for API routes. Returns null if OK, or a 401 response. */
export function requireAuth(req: NextRequest): NextResponse | null {
  if (!isAuthEnabled()) return null; // auth disabled in dev
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
