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
// logged-in GET handler, then `setCsrfCookie(res, token)` to set the
// HttpOnly+SameSite=Strict cookie, and return the token in the JSON body
// so the client can send it back as `x-csrf-token` on state-changing
// requests.

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
 *      `csrf-token` (use `setCsrfCookie` below — it sets the correct
 *      security flags).
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

/**
 * Set the CSRF double-submit cookie on a NextResponse.
 *
 * v6 audit fix: the cookie MUST be set with `httpOnly: true` and
 * `sameSite: "strict"` to prevent:
 *   - **XSS exfiltration** of the token (httpOnly blocks `document.cookie`
 *     reads from injected scripts; without it, an XSS payload could steal
 *     the CSRF token and forge state-changing requests).
 *   - **Cross-site request submission** (sameSite=strict blocks the
 *     cookie from being sent on cross-site requests, so a CSRF attack
 *     can't even submit the double-submit cookie — the server-side
 *     header-vs-cookie comparison fails before the request reaches
 *     business logic).
 *
 * `secure: true` in production ensures the cookie is only set over HTTPS
 * (prevents network-layer interception on plain-HTTP transports). In dev
 * (NODE_ENV !== "production") `secure` is false so localhost HTTP works.
 *
 * Usage (cookie-based auth GET handler, e.g. `/api/auth/csrf`):
 *
 *   import { issueCsrfToken, setCsrfCookie } from "@/lib/csrf";
 *
 *   export async function GET(req: NextRequest) {
 *     const token = issueCsrfToken();
 *     const res = NextResponse.json({ token });
 *     setCsrfCookie(res, token);
 *     return res;
 *   }
 *
 * The token is also returned in the JSON body — the client reads it from
 * the response and sends it back as the `x-csrf-token` header on the
 * next POST/PUT/PATCH/DELETE.
 */
export function setCsrfCookie(res: NextResponse, token: string): void {
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 24h — matches the NextAuth session-token lifetime. A shorter
    // lifetime would force re-fetching the CSRF token more often than
    // the session itself refreshes, which is annoying for users
    // mid-flow. A longer lifetime would extend the window for a
    // stolen-token CSRF attack (mitigated by httpOnly + sameSite).
    maxAge: 60 * 60 * 24,
  });
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
