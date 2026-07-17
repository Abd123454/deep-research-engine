// CSRF protection utility for state-changing API routes.
//
// Quaesitor currently uses HTTP Basic Auth (see `src/lib/auth.ts`). Browsers
// do NOT auto-send Basic credentials on cross-origin requests (they require
// an explicit `Authorization` header), so the classic CSRF vector — "the
// victim's browser silently attaches a cookie that authenticates the
// request" — does not apply.
//
// This module exists for the **future cookie-based auth migration**
// (e.g. NextAuth.js with session cookies). When that migration lands,
// `validateCsrf(req)` is ready to enforce a double-submit-cookie CSRF
// token on POST/PUT/PATCH/DELETE requests. Until then it is a safe no-op
// for Basic Auth traffic.
//
// Usage in a route handler:
//
//   import { validateCsrf } from "@/lib/csrf";
//
//   export async function POST(req: NextRequest) {
//     const csrfFail = validateCsrf(req);
//     if (csrfFail) return csrfFail;
//     // ...rest of handler
//   }
//
// To mint a token (cookie-based auth only), call `issueCsrfToken()` from a
// logged-in GET handler and set both the cookie and return the token in
// JSON for the client to send back as `x-csrf-token`.

import { NextRequest, NextResponse } from "next/server";

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf-token";

/**
 * Validate the CSRF token on state-changing requests.
 *
 * - GET/HEAD/OPTIONS: always allowed (no state change).
 * - Requests with an `Authorization: Basic ...` header: allowed (Basic Auth
 *   is not vulnerable to CSRF — browsers don't auto-attach it cross-origin).
 * - Cookie-authenticated requests: require a matching `x-csrf-token` header
 *   and `csrf-token` cookie (double-submit pattern).
 *
 * Returns `null` if the request is allowed, or a 403 NextResponse if blocked.
 */
export function validateCsrf(req: NextRequest): NextResponse | null {
  // Only check state-changing methods.
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return null;

  // If using Basic Auth (Authorization header present), no CSRF check is
  // needed — browsers don't auto-send Basic creds cross-origin, so a CSRF
  // attack cannot forge an authenticated request.
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Basic ")) return null;

  // Bearer tokens (API keys, e.g. for /api/mcp) are also not auto-attached
  // by browsers, so they're safe from classic CSRF.
  if (authHeader && authHeader.startsWith("Bearer ")) return null;

  // For cookie-based auth: validate double-submit cookie token.
  // Currently a no-op in practice (Quaesitor doesn't issue session cookies
  // yet), but ready for the cookie-auth migration.
  const headerToken = req.headers.get(CSRF_HEADER);
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;

  if (!headerToken || !cookieToken || !constTimeEqual(headerToken, cookieToken)) {
    return NextResponse.json(
      { ok: false, error: "CSRF token validation failed." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Issue a new CSRF token for cookie-based auth sessions.
 *
 * Call this from a logged-in GET handler (e.g. `/api/auth/csrf`) and:
 *   1. Set the returned token as an HttpOnly+SameSite=Strict cookie named
 *      `csrf-token`.
 *   2. Return it in the JSON body so the client can send it back as the
 *      `x-csrf-token` header on state-changing requests.
 *
 * NOTE: not currently wired up — Quaesitor uses Basic Auth. Provided for
 * the future cookie-auth migration.
 */
export function issueCsrfToken(): string {
  // 32 bytes of randomness → 64 hex chars. Sufficient for a session-scoped
  // CSRF token. Uses Web Crypto (available in Next.js runtime).
  const bytes = new Uint8Array(32);
  // `globalThis.crypto` is available in Node 19+ and edge runtime.
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string compare to prevent timing attacks on token validation.
function constTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export { CSRF_HEADER, CSRF_COOKIE };
