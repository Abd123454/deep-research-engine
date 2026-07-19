// CORS lock for API routes.
//
// The research API calls NVIDIA NIM (costs tokens) and runs long-running
// searches. Allowing any origin to POST /api/research/start is a CSRF +
// resource-exhaustion risk. This middleware rejects cross-origin API
// requests unless the Origin matches the server's own host or an
// explicitly-allowed domain (via ALLOWED_ORIGINS env var).
//
// Same-origin requests (the normal case: browser → same server) always pass.
// Non-browser requests without Origin header are allowed ONLY for safe
// methods (GET, HEAD, OPTIONS) — POST/PUT/DELETE without Origin are rejected
// to prevent CSRF bypass via curl/forged requests.

import { NextRequest, NextResponse } from "next/server";
import { validateCsrf } from "./lib/csrf";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function isAllowedOrigin(origin: string): boolean {
  // NM-1 (CVSS 5.5) v5 audit fix: only allow localhost origins in
  // non-production. In production, localhost/127.0.0.1 origins are
  // rejected outright — a misconfigured production deploy that
  // happens to listen on localhost (or an attacker who can trick a
  // user into visiting http://localhost:3000) must not be able to
  // bypass the CORS allowlist via a literal-localhost Origin header.
  const localhost =
    process.env.NODE_ENV !== "production"
      ? [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        ]
      : [];
  if (localhost.includes(origin)) return true;

  // Check ALLOWED_ORIGINS env var (comma-separated).
  const allowed = process.env.ALLOWED_ORIGINS;
  if (allowed) {
    const list = allowed.split(",").map((s) => s.trim());
    if (list.includes(origin) || list.includes("*")) return true;
  }

  return false;
}

// In Next.js 16, the proxy file must export a function named `proxy`
// (or a default export). This replaces the old `middleware` export name.
export function proxy(req: NextRequest) {
  // Only enforce on API routes.
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    if (origin && isAllowedOrigin(origin)) {
      const res = new NextResponse(null, { status: 204 });
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.headers.set("Access-Control-Max-Age", "86400");
      return res;
    }
    return new NextResponse(null, { status: 403 });
  }

  // H-4: CSRF validation for state-changing requests. The CORS check
  // above already rejects cross-origin POST/PUT/PATCH/DELETE from
  // unallowed origins, but a cookie-authenticated session is still
  // vulnerable to CSRF if a same-origin XSS escapes the CORS net or
  // if ALLOWED_ORIGINS is misconfigured. `validateCsrf` is a no-op for
  // Basic-Auth / Bearer-token requests (those aren't vulnerable to
  // CSRF because browsers don't auto-attach them cross-origin) and
  // enforces a double-submit cookie for cookie-authenticated sessions.
  //
  // Skip CSRF for paths that have their own signature-based integrity
  // check:
  //   - /api/auth/*        — NextAuth issues + validates its own CSRF
  //                          token (double-submit cookie, signed).
  //   - /api/billing/webhook — Stripe signs the request body with
  //                          STRIPE_WEBHOOK_SECRET; signature verify
  //                          replaces CSRF for server-to-server calls.
  //
  // Also skip when AUTH_DEV_BYPASS=1 — matches the auth.ts dev bypass
  // so local dev (no Basic Auth configured) isn't blocked by the CSRF
  // gate before reaching `requireAuth` (which itself bypasses in dev).
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    process.env.AUTH_DEV_BYPASS !== "1"
  ) {
    const path = req.nextUrl.pathname;
    if (
      !path.startsWith("/api/auth/") &&
      !path.startsWith("/api/billing/webhook")
    ) {
      const csrfError = validateCsrf(req);
      if (csrfError) return csrfError;
    }
  }

  const origin = req.headers.get("origin");

  // No Origin header = non-browser request (curl, server-to-server).
  // Allow only for safe methods (GET, HEAD) — block POST/PUT/DELETE to
  // prevent CSRF-style bypass where an attacker forges a request without Origin.
  if (!origin) {
    if (SAFE_METHODS.includes(req.method)) {
      return NextResponse.next();
    }
    // State-changing methods without Origin header — reject in production
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        JSON.stringify({ error: "Missing Origin header for state-changing request" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    // Dev: allow for DX
    return NextResponse.next();
  }

  if (isAllowedOrigin(origin)) {
    const res = NextResponse.next();
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.headers.set("Access-Control-Max-Age", "86400");
    return res;
  }

  // Cross-origin request from an unallowed site → reject.
  return new NextResponse(
    JSON.stringify({ error: "Origin not allowed" }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export const config = {
  matcher: "/api/:path*",
};
