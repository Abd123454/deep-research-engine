// Skills-audit test suite — Project + conversation ownership +
// masked credentials (skills-audit security pass).
//
// The GET /api/projects/[id] route previously had NO auth check, NO
// ownership check, AND returned decrypted connector credentials in
// plaintext. The GET /api/chat/conversations/[id] route had auth but
// NO ownership check — any authenticated user could read any other
// user's conversation by ID. Both are now fixed.
//
// This file is separate from security-fixes.test.ts because the route
// imports `@/lib/auth`, `@/lib/credentials`, `@/lib/audit` — none of
// which are mocked in security-fixes.test.ts. Mocking `@/lib/auth`
// globally would break test 3 in security-fixes.test.ts (which uses
// the real `getUserId`). Isolating the test in its own file keeps
// the mock surface local.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the DB so we don't depend on a real SQLite file.
// `vi.fn()` with no type args returns a Mock<(...args: any[]) => any>
// — `mockReturnValue` then accepts any value (undefined for "not
// found", { user_id: "..." } for ownership tests).
const mockGet: ReturnType<typeof vi.fn> = vi.fn();
const mockRun = vi.fn();
const mockAll = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    prepare: () => ({ get: mockGet, run: mockRun, all: mockAll }),
    exec: vi.fn(),
  }),
  isPostgresAvailable: () => false,
  getPrismaDb: async () => null,
}));

// Mock credentials so we don't need real crypto + can assert calls.
vi.mock("@/lib/credentials", () => ({
  decryptCredentials: vi.fn(() => null),
  maskCredentials: vi.fn((creds: Record<string, string>) => creds),
  encryptCredentials: vi.fn(() => "encrypted"),
}));

// Mock audit so we don't write to a real DB.
vi.mock("@/lib/audit", () => ({
  logSensitiveAction: vi.fn(),
  logAudit: vi.fn(),
  SENSITIVE_ACTIONS: {
    "research.delete": "research",
    "project.create": "project",
    "project.update": "project",
    "project.delete": "project",
  } as Record<string, string>,
}));

// Mock Sentry so we don't pull in the real SDK.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock logger so the test output stays quiet.
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
    })),
  },
}));

// Mock rate-limit so auth.ts (which imports getClientIP) doesn't fail.
vi.mock("@/lib/rate-limit", () => ({
  checkStartRateLimit: vi.fn(async () => ({ ok: true })),
  releaseConcurrency: vi.fn(),
  getClientIP: vi.fn(() => "127.0.0.1"),
}));

// Mock auth — we exercise the route's auth gate logic (does it call
// requireAuth and return early on failure?) without pulling in the
// real auth.ts module (which itself imports `@/lib/env`, `@/lib/db`,
// etc. that aren't mocked here). The mock re-implements the auth
// check against AUTH_USERNAME/AUTH_PASSWORD env vars — faithful to
// the real requireAuth behavior so the route's 401/404/200 paths
// are exercised correctly.
function makeJsonResponse(status: number, body: unknown) {
  return {
    status,
    headers: new Map([["Content-Type", "application/json"]]),
    json: async () => body,
  };
}
vi.mock("@/lib/auth", () => ({
  isAuthEnabled: () =>
    !!process.env.AUTH_USERNAME && !!process.env.AUTH_PASSWORD,
  isAuthOptional: () => process.env.AUTH_DEV_BYPASS === "1",
  requireAuth: (req: Request) => {
    if (!process.env.AUTH_USERNAME || !process.env.AUTH_PASSWORD) {
      if (process.env.AUTH_DEV_BYPASS === "1") return null;
      return makeJsonResponse(503, { ok: false, error: "Auth not configured." });
    }
    const header = req.headers.get("authorization");
    if (!header || !header.startsWith("Basic ")) {
      return makeJsonResponse(401, { ok: false, error: "Authentication required." });
    }
    const encoded = header.slice(6);
    let decoded: string;
    try {
      decoded = Buffer.from(encoded, "base64").toString("utf-8");
    } catch {
      return makeJsonResponse(401, { ok: false, error: "Authentication required." });
    }
    const idx = decoded.indexOf(":");
    if (idx < 0) {
      return makeJsonResponse(401, { ok: false, error: "Authentication required." });
    }
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (user !== process.env.AUTH_USERNAME || pass !== process.env.AUTH_PASSWORD) {
      return makeJsonResponse(401, { ok: false, error: "Authentication required." });
    }
    return null;
  },
  getUserId: () => process.env.AUTH_USERNAME || "default",
}));

describe("skills-audit: project + conversation ownership", () => {
  const origAuthUser = process.env.AUTH_USERNAME;
  const origAuthPass = process.env.AUTH_PASSWORD;
  const origNodeEnv = process.env.NODE_ENV;
  const origDevBypass = process.env.AUTH_DEV_BYPASS;

  const validAuth = "Basic " + Buffer.from("admin:secret").toString("base64");

  beforeEach(() => {
    // Configure auth so requireAuth gates fire.
    process.env.AUTH_USERNAME = "admin";
    process.env.AUTH_PASSWORD = "secret";
    process.env.AUTH_DEV_BYPASS = "";
    mockGet.mockReset();
    mockRun.mockReset();
    mockAll.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    if (origAuthUser === undefined) delete env.AUTH_USERNAME;
    else env.AUTH_USERNAME = origAuthUser;
    if (origAuthPass === undefined) delete env.AUTH_PASSWORD;
    else env.AUTH_PASSWORD = origAuthPass;
    if (origDevBypass === undefined) delete env.AUTH_DEV_BYPASS;
    else env.AUTH_DEV_BYPASS = origDevBypass;
    if (origNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = origNodeEnv;
  });

  it("GET /api/projects/[id] returns 401 without Authorization header", async () => {
    mockGet.mockReturnValue(undefined);
    const { GET } = await import("../../app/api/projects/[id]/route");
    const req = new NextRequest("http://localhost/api/projects/abc", {
      method: "GET",
    });
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(401);
    // The DB lookup must NOT fire — auth fails before it.
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("GET /api/projects/[id] returns 404 for someone else's project", async () => {
    // The DB returns a project row owned by a DIFFERENT user.
    mockGet.mockReturnValue({ user_id: "someone-else" });
    const { GET } = await import("../../app/api/projects/[id]/route");
    const req = new NextRequest("http://localhost/api/projects/abc", {
      method: "GET",
      headers: { authorization: validAuth },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) });
    // 404 (NOT 403) so we don't leak the existence of other users' IDs.
    expect(res.status).toBe(404);
  });

  it("GET /api/chat/conversations/[id] returns 404 for another user's conversation", async () => {
    // DB returns a conversation owned by a different user.
    mockGet.mockReturnValue({ user_id: "someone-else" });
    const { GET } = await import(
      "../../app/api/chat/conversations/[id]/route"
    );
    const req = new NextRequest(
      "http://localhost/api/chat/conversations/conv-123",
      { method: "GET", headers: { authorization: validAuth } }
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "conv-123" }),
    });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/projects/[id] returns 404 for someone else's project", async () => {
    mockGet.mockReturnValue({ user_id: "someone-else" });
    const { DELETE } = await import("../../app/api/projects/[id]/route");
    const req = new NextRequest("http://localhost/api/projects/abc", {
      method: "DELETE",
      headers: { authorization: validAuth },
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(404);
    // The DELETE SQL must NOT run — ownership check fails first.
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("GET /api/chat/conversations returns 401 without Authorization header", async () => {
    mockAll.mockReturnValue([]);
    const { GET } = await import(
      "../../app/api/chat/conversations/route"
    );
    const req = new NextRequest("http://localhost/api/chat/conversations", {
      method: "GET",
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
