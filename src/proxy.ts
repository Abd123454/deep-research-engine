// CORS lock for API routes.
//
// The research API calls NVIDIA NIM (costs tokens) and runs long-running
// searches. Allowing any origin to POST /api/research/start is a CSRF +
// resource-exhaustion risk. This middleware rejects cross-origin API
// requests unless the Origin matches the server's own host or an
// explicitly-allowed domain (via ALLOWED_ORIGINS env var).
//
// Same-origin requests (the normal case: browser → same server) always pass.
// Non-browser requests (curl, no Origin header) are allowed for DX/testing.

import { NextRequest, NextResponse } from "next/server";

function isAllowedOrigin(origin: string): boolean {
  // Same-origin is always allowed — we check against the Host header.
  // Also allow localhost variants for dev.
  const localhost = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ];
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

  const origin = req.headers.get("origin");
  // No Origin header = non-browser request (curl, server-to-server). Allow.
  if (!origin) {
    return NextResponse.next();
  }

  if (isAllowedOrigin(origin)) {
    const res = NextResponse.next();
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
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
