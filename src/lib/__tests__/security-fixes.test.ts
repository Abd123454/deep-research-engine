// Security-fixes test suite — one test per remediation module from the
// v3 audit follow-ups (fix-8-high + fix-7-remaining + earlier rounds).
//
// Each test covers ONE module so a regression in any single fix surfaces
// a single named failure rather than a cascading test explosion. Mocks
// are kept minimal — we test the security boundary, not the DB plumbing.
//
// Modules covered (10):
//   1. verification-tokens — single-use create/consume semantics
//   2. AUTH_DEV_BYPASS      — isAuthOptional is opt-in, not NODE_ENV-based
//   3. getUserId            — resolves Basic-auth caller → AUTH_USERNAME
//   4. DOMPurify            — strips <script> from SVG/HTML payloads
//   5. safeFetch            — rejects private IP ranges (SSRF defense)
//   6. CSRF                 — POST without Authorization/Origin → 403
//   7. sanitizeError        — strips Bearer tokens + API-key patterns
//   8. maskCredentials      — returns masked tail, not plaintext
//   9. MFA per-user         — getUserMfaSecret reads from user_mfa table
//  10. NEXTAUTH_SECRET      — three-mode check (build / runtime-prod / dev)

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Unified DB mock — supports BOTH the verification_tokens table (test 1)
// AND the user_mfa table (test 9) via a flexible .prepare() router that
// sniffs the SQL and routes to the right in-memory store. vi.mock is
// hoisted by vitest to run BEFORE the static imports below.
// ============================================================================

const tokenRows = new Map<
  string,
  {
    id: string;
    user_id: string;
    token: string;
    type: string;
    expires_at: string;
    used_at: string | null;
  }
>();

const mfaRows = new Map<
  string,
  { user_id: string; secret: string; backup_code_hashes: string; enabled: number }
>();

const mockDb = {
  exec: vi.fn(() => undefined),
  prepare: (sql: string) => {
    const isInsertToken = /INSERT INTO verification_tokens/i.test(sql);
    const isConsumeSelectToken =
      /SELECT user_id FROM verification_tokens[\s\S]*WHERE token = \?[\s\S]*used_at IS NULL/i.test(sql);
    const isConsumeUpdateToken = /UPDATE verification_tokens SET used_at/i.test(sql);
    const isFindSelectToken = /SELECT id, user_id, token, type/i.test(sql);
    const isMfaSelect = /SELECT \* FROM user_mfa WHERE user_id = \?/i.test(sql);

    return {
      run: (...args: unknown[]) => {
        if (isInsertToken) {
          const [id, userId, token, type, expiresAt] = args as [
            string,
            string,
            string,
            string,
            string
          ];
          tokenRows.set(token, {
            id,
            user_id: userId,
            token,
            type,
            expires_at: expiresAt,
            used_at: null,
          });
        } else if (isConsumeUpdateToken) {
          const [token] = args as [string];
          const row = tokenRows.get(token);
          if (row) row.used_at = new Date().toISOString();
        }
        return { changes: 1 };
      },
      get: (...args: unknown[]) => {
        const [first, second] = args as [string, string];
        if (isConsumeSelectToken || isFindSelectToken) {
          const row = tokenRows.get(first);
          // Match WHERE clauses: token = ?, type = ?, used_at IS NULL.
          if (row && row.type === second && row.used_at === null) {
            return row;
          }
          return undefined;
        }
        if (isMfaSelect) {
          return mfaRows.get(first);
        }
        return undefined;
      },
      all: () => [] as unknown[],
    };
  },
  // better-sqlite3 transactions are synchronous — `transaction(fn)` returns
  // a new function that runs fn inside a BEGIN/COMMIT. For mock purposes we
  // just return the fn itself (the test doesn't need real locking).
  transaction: <T>(fn: () => T): (() => T) => fn,
};

vi.mock("../db", () => ({
  getDb: () => mockDb,
  isPostgresAvailable: () => false,
  getPrismaDb: async () => null,
}));

// verification-tokens.ts imports via the `@/lib/db` alias — we need to
// mock the alias path too so the alias-resolved import resolves to the
// same mock instance.
vi.mock("@/lib/db", () => ({
  getDb: () => mockDb,
  isPostgresAvailable: () => false,
  getPrismaDb: async () => null,
}));

// The NextAuth route module also imports `@/lib/logger` (pino) and
// `@/lib/sqlite-types` (type-only). Type imports are erased at compile
// time, but `@/lib/logger` is a runtime import — when test 10 below
// dynamically re-imports the route to re-trigger the NEXTAUTH_SECRET
// module-load check, pino would otherwise be initialized (writes to
// stdout, picks up real LOG_LEVEL, etc.). Mocking it keeps the test
// focused on the secret check and silent on logger side effects.
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

// v5 audit fix NH-1: the NextAuth route now imports `@/lib/rate-limit`
// (for the per-IP sign-in throttle). The dynamic-import test
// re-triggers the module-load check under different env, so the
// alias must resolve to a mock — otherwise vitest's alias resolver
// fails with "Cannot find package '@/lib/rate-limit'" when the route
// module is re-imported after vi.resetModules(). The mock returns
// a permissive rate-limit result (ok: true) so the wrapper passes
// through to the real NextAuth handler.
vi.mock("@/lib/rate-limit", () => ({
  checkStartRateLimit: vi.fn(async () => ({ ok: true })),
  releaseConcurrency: vi.fn(),
  getClientIP: vi.fn(() => "127.0.0.1"),
}));

// Import after vi.mock (vitest hoists the mock above these imports).
import {
  createVerificationToken,
  consumeVerificationToken,
} from "../verification-tokens";
import { isAuthOptional, getUserId } from "../auth";
import { safeFetch } from "../safe-fetch";
import { validateCsrf } from "../csrf";
import { sanitizeError } from "../sanitize-error";
import { maskCredentials } from "../credentials";
import { getUserMfaSecret } from "../mfa";

// ============================================================================
// Test 1 — verification-tokens: create → consume → can't consume again
// ============================================================================
describe("1. verification-tokens: single-use create/consume", () => {
  beforeEach(() => {
    tokenRows.clear();
    mockDb.exec.mockClear();
  });

  it("create → consume → second consume fails (single-use)", async () => {
    const userId = "user-abc";
    const token = await createVerificationToken(userId, "email_verification");
    expect(typeof token).toBe("string");
    // 32 random bytes hex-encoded = 64 chars.
    expect(token.length).toBeGreaterThanOrEqual(32);

    // First consume — succeeds, returns the userId.
    const first = await consumeVerificationToken(token, "email_verification");
    expect(first).not.toBeNull();
    expect(first?.userId).toBe(userId);

    // Second consume — must fail (token is now used_at NOT NULL).
    const second = await consumeVerificationToken(token, "email_verification");
    expect(second).toBeNull();
  });
});

// ============================================================================
// Test 2 — AUTH_DEV_BYPASS: isAuthOptional returns false by default, true
// only when AUTH_DEV_BYPASS=1. C-4 fix: never auto-bypass based on NODE_ENV.
// ============================================================================
describe("2. AUTH_DEV_BYPASS: opt-in only, never NODE_ENV-based", () => {
  const origBypass = process.env.AUTH_DEV_BYPASS;
  const origNodeEnv = process.env.NODE_ENV;

  // Cast process.env to a writable record so we can mutate NODE_ENV
  // (TypeScript declares it as a read-only string in @types/node).
  const env = process.env as unknown as Record<string, string | undefined>;

  afterEach(() => {
    if (origBypass === undefined) delete process.env.AUTH_DEV_BYPASS;
    else process.env.AUTH_DEV_BYPASS = origBypass;
    if (origNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = origNodeEnv;
  });

  it("returns false by default (no env set) in production", () => {
    delete process.env.AUTH_DEV_BYPASS;
    env.NODE_ENV = "production";
    expect(isAuthOptional()).toBe(false);
  });

  it("returns false in dev (NODE_ENV=development) without the explicit flag", () => {
    delete process.env.AUTH_DEV_BYPASS;
    env.NODE_ENV = "development";
    // C-4: previously returned true here — left every preview deploy open.
    expect(isAuthOptional()).toBe(false);
  });

  it("returns true ONLY when AUTH_DEV_BYPASS=1 is set explicitly", () => {
    process.env.AUTH_DEV_BYPASS = "1";
    env.NODE_ENV = "production";
    expect(isAuthOptional()).toBe(true);
  });

  it("returns false for AUTH_DEV_BYPASS=0 / 'true' / arbitrary strings", () => {
    for (const v of ["0", "true", "yes", "on"]) {
      process.env.AUTH_DEV_BYPASS = v;
      expect(isAuthOptional()).toBe(false);
    }
  });
});

// ============================================================================
// Test 3 — getUserId: a request with valid Basic auth resolves to
// AUTH_USERNAME (the source-of-truth tenant id), not a client-supplied
// string. Anonymous requests are isolated under `anon:default`.
// ============================================================================
describe("3. getUserId: Basic-auth request resolves to AUTH_USERNAME", () => {
  const origUser = process.env.AUTH_USERNAME;
  const origPass = process.env.AUTH_PASSWORD;

  afterEach(() => {
    if (origUser === undefined) delete process.env.AUTH_USERNAME;
    else process.env.AUTH_USERNAME = origUser;
    if (origPass === undefined) delete process.env.AUTH_PASSWORD;
    else process.env.AUTH_PASSWORD = origPass;
  });

  it("returns AUTH_USERNAME for a request with valid Basic creds", () => {
    process.env.AUTH_USERNAME = "alice";
    process.env.AUTH_PASSWORD = "s3cret";
    // btoa("alice:s3cret") === "YWxpY2U6czNjcmV0"
    const req = new NextRequest("https://example.com/api/research/start", {
      method: "POST",
      headers: { authorization: "Basic YWxpY2U6czNjcmV0" },
    });
    expect(getUserId(req)).toBe("alice");
  });

  it("returns anon:default for a request with no auth header (when auth configured)", () => {
    process.env.AUTH_USERNAME = "alice";
    process.env.AUTH_PASSWORD = "s3cret";
    const req = new NextRequest("https://example.com/api/research/start", {
      method: "POST",
    });
    expect(getUserId(req)).toBe("anon:default");
  });
});

// ============================================================================
// Test 4 — DOMPurify sanitization: HTML with <script> tags → no <script>
// in the sanitized output. Mirrors the H-2 mermaid-SVG defense, applied to
// a plain HTML payload.
// ============================================================================
describe("4. DOMPurify sanitization: <script> stripped from HTML", () => {
  beforeAll(async () => {
    // DOMPurify needs a DOM. In Node we provide jsdom.
    if (typeof globalThis.window === "undefined") {
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
      // jsdom's window is a subset of the browser's globalThis — cast to
      // `any` so TypeScript doesn't complain about the ~510 missing
      // properties (we only use the DOMParser / document subset).
      (globalThis as unknown as { window: unknown }).window = dom.window;
      (globalThis as unknown as { document: Document }).document = dom.window.document;
    }
  });

  it("strips <script> tags and onerror handlers from an HTML payload", async () => {
    const { default: DOMPurify } = await import("dompurify");
    const malicious =
      '<div>Hello</div><script>alert("xss")</script><img src="x" onerror="alert(1)">';

    const clean = DOMPurify.sanitize(malicious, {
      FORBID_TAGS: ["script", "object", "embed", "iframe"],
      FORBID_ATTR: ["onerror", "onload", "onclick"],
    });

    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("onerror");
    // Safe content survives.
    expect(clean).toContain("Hello");
  });
});

// ============================================================================
// Test 5 — safeFetch: rejects requests to private/loopback/metadata IP
// ranges (SSRF defense). Tests the literal-IP path so we don't depend on
// real DNS resolution (skipped in vitest via VITEST=true).
// ============================================================================
describe("5. safeFetch: rejects private IP ranges (SSRF defense)", () => {
  // Each entry is a URL whose hostname is a literal private/loopback IP.
  // safeFetch should reject all of them before issuing a fetch.
  const blocked: Array<[string, string]> = [
    ["http://127.0.0.1/", "loopback"],
    ["http://10.0.0.1/", "private 10/8"],
    ["http://169.254.169.254/latest/meta-data/", "AWS metadata"],
    ["http://192.168.1.1/", "private 192.168/16"],
    ["http://172.16.0.1/", "private 172.16/12"],
  ];

  for (const [url, label] of blocked) {
    it(`rejects ${label} (${url})`, async () => {
      // safeFetch should throw — the SSRF check fires before any fetch.
      await expect(safeFetch(url)).rejects.toThrow(/SSRF blocked/i);
    });
  }
});

// ============================================================================
// Test 6 — CSRF validation: a POST without an Authorization header AND
// without a matching x-csrf-token/csrf-token pair returns a 403 response.
// (Cookie-authenticated requests need the double-submit token.)
// ============================================================================
describe("6. CSRF: POST without Authorization/CSRF token → 403", () => {
  it("returns a 403 NextResponse for a cookie-auth POST with no CSRF token", async () => {
    const req = new NextRequest("https://example.com/api/research/start", {
      method: "POST",
      // No Authorization header, no x-csrf-token header, no csrf-token cookie.
      headers: { "content-type": "application/json" },
    });
    const fail = validateCsrf(req);
    expect(fail).not.toBeNull();
    // The NextResponse body is a JSON error — status 403.
    expect(fail?.status).toBe(403);
    const body = await fail?.json();
    expect(body?.ok).toBe(false);
    expect(String(body?.error).toLowerCase()).toContain("csrf");
  });

  it("allows a POST with Authorization: Basic (Basic Auth is not CSRF-vulnerable)", () => {
    const req = new NextRequest("https://example.com/api/research/start", {
      method: "POST",
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(validateCsrf(req)).toBeNull();
  });
});

// ============================================================================
// Test 7 — sanitizeError: strips Bearer tokens + API-key patterns before
// the error message reaches the client. P0-10 fix.
// ============================================================================
describe("7. sanitizeError: strips Bearer tokens and API keys", () => {
  it("strips Bearer tokens from the error message", () => {
    const err = new Error(
      "Request failed: Bearer abc123def456ghi789 Authorization: Bearer xyz789token"
    );
    const clean = sanitizeError(err);
    expect(clean).not.toContain("abc123def456ghi789");
    expect(clean).not.toContain("xyz789token");
    expect(clean).toContain("[REDACTED]");
  });

  it("strips known API-key prefixes (sk-, nvapi-, sk-ant-)", () => {
    const err = new Error(
      "OpenAI call failed with key sk-1234567890abcdefghij and NVIDIA nvapi-1234567890abcdefghij and Anthropic sk-ant-1234567890abcdefghij"
    );
    const clean = sanitizeError(err);
    expect(clean).not.toContain("sk-1234567890abcdefghij");
    expect(clean).not.toContain("nvapi-1234567890abcdefghij");
    expect(clean).not.toContain("sk-ant-1234567890abcdefghij");
    expect(clean).toContain("[REDACTED]");
  });

  it("strips connection-string credentials", () => {
    const err = new Error(
      "DB connect failed: postgresql://admin:supersecret@db.example.com:5432/prod"
    );
    const clean = sanitizeError(err);
    expect(clean).not.toContain("supersecret");
    expect(clean).toContain("[REDACTED]");
  });

  it("never throws on weird inputs (null, circular refs, plain objects)", () => {
    // null is JSON-serializable ("null") — must not throw.
    expect(() => sanitizeError(null)).not.toThrow();
    // Plain object with a message property — a common shape thrown by libs.
    expect(() => sanitizeError({ message: "x" })).not.toThrow();
    // Circular reference — JSON.stringify throws, the catch branch must
    // swallow it and fall back to String(err) so the function still returns.
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => sanitizeError(circular)).not.toThrow();
  });
});

// ============================================================================
// Test 8 — maskCredentials: returns masked tail (••••last4), never the
// plaintext. V1 audit fix — the GET /api/connectors response used to leak
// plaintext GitHub tokens.
// ============================================================================
describe("8. maskCredentials: returns masked tail, not plaintext", () => {
  it("masks a long token to ••••<last4>", () => {
    const token = "ghp_abcdef1234567890xyz";
    const masked = maskCredentials({ github: token });
    expect(masked.github).toBe("••••" + token.slice(-4));
    // Plaintext never appears in full.
    expect(masked.github).not.toContain(token);
  });

  it("masks multiple fields independently", () => {
    const creds = {
      github: "ghp_longtokenstring1234",
      stripe: "sk_live_abcdef1234567890",
      slack: "xoxb-token-string-here-1234",
    };
    const masked = maskCredentials(creds);
    for (const key of Object.keys(creds)) {
      expect(masked[key]).not.toBe(creds[key as keyof typeof creds]);
      expect(masked[key]).toContain("••••");
    }
  });

  it("fully masks short values (<=8 chars) without revealing a tail", () => {
    const masked = maskCredentials({ short: "abc", pin: "1234" });
    expect(masked.short).toBe("••••");
    expect(masked.pin).toBe("••••");
  });
});

// ============================================================================
// Test 9 — MFA per-user: getUserMfaSecret reads from the user_mfa table
// (H-8 fix — previously every user shared one MFA_SECRET env var).
// ============================================================================
describe("9. MFA per-user: getUserMfaSecret reads from user_mfa table", () => {
  const origMfaSecret = process.env.MFA_SECRET;

  beforeEach(() => {
    mfaRows.clear();
    if (origMfaSecret === undefined) delete process.env.MFA_SECRET;
    else process.env.MFA_SECRET = origMfaSecret;
  });

  afterEach(() => {
    if (origMfaSecret === undefined) delete process.env.MFA_SECRET;
    else process.env.MFA_SECRET = origMfaSecret;
  });

  it("returns the per-user secret for an ENABLED MFA record", () => {
    const secret = "JBSWY3DPEHPK3PXP"; // sample base32 secret
    mfaRows.set("user-1", {
      user_id: "user-1",
      secret,
      backup_code_hashes: "[]",
      enabled: 1, // ENABLED — counts
    });
    expect(getUserMfaSecret("user-1")).toBe(secret);
  });

  it("returns null for a pending (enabled=0) MFA record (pending setup != access)", () => {
    mfaRows.set("user-2", {
      user_id: "user-2",
      secret: "JBSWY3DPEHPK3PXP",
      backup_code_hashes: "[]",
      enabled: 0, // PENDING — must NOT grant access
    });
    // With no env fallback, this returns null.
    delete process.env.MFA_SECRET;
    expect(getUserMfaSecret("user-2")).toBeNull();
  });

  it("falls back to MFA_SECRET env var when no per-user record exists (backward compat)", () => {
    process.env.MFA_SECRET = "LEGACY_SHARED_SECRET";
    // No row in the table for user-3.
    expect(getUserMfaSecret("user-3")).toBe("LEGACY_SHARED_SECRET");
  });
});

// ============================================================================
// Test 10 — NEXTAUTH_SECRET behavior: the C-1 fix has three modes
// (build phase: silent fallback / runtime production: throw / dev: warn +
// fallback). The module-load check runs when the route file is first
// imported, so each test must (a) reset the module cache, (b) set the
// env to match the mode, (c) dynamically import the route file so the
// check re-runs under the new env.
// ============================================================================
describe("10. NEXTAUTH_SECRET behavior", () => {
  const origSecret = process.env.NEXTAUTH_SECRET;
  const origPhase = process.env.NEXT_PHASE;
  const origNodeEnv = process.env.NODE_ENV;
  const env = process.env as unknown as Record<string, string | undefined>;

  afterEach(() => {
    // Restore every env var we touched so subsequent tests get the
    // vitest-default env (NODE_ENV=test, no NEXT_PHASE, etc.).
    if (origSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = origSecret;
    if (origPhase === undefined) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = origPhase;
    if (origNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = origNodeEnv;
    // Clear the module cache so the next import re-runs the check.
    vi.resetModules();
  });

  it("uses dev fallback when NEXTAUTH_SECRET not set and not runtime production", async () => {
    // Dev mode: no NEXTAUTH_SECRET, no NEXT_PHASE (not a build), NODE_ENV
    // is not "production" (vitest sets it to "test" by default).
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.NEXT_PHASE;
    env.NODE_ENV = "development";

    // Re-import the route module — its top-level check runs again under
    // the new env. The mock for `@/lib/db` is hoisted by vitest and
    // survives vi.resetModules, so the dynamic import resolves to the
    // mocked DB (no real Postgres/SQLite call at module load).
    const mod = await import(
      "../../app/api/auth/[...nextauth]/route"
    );
    expect(mod.authOptions.secret).toBe("dev-only-not-for-production");
    expect(typeof mod.authOptions.secret).toBe("string");
  });

  it("throws when NEXTAUTH_SECRET not set in runtime production", async () => {
    // Runtime production: NODE_ENV=production AND NEXT_PHASE is NOT
    // "phase-build-data-collection" (we use the production-server phase
    // explicitly so the build-phase guard doesn't fire).
    delete process.env.NEXTAUTH_SECRET;
    process.env.NEXT_PHASE = "phase-production-server";
    env.NODE_ENV = "production";

    // Dynamic import wraps the module-load throw in a rejected promise.
    // The error message must include the literal "NEXTAUTH_SECRET must
    // be set" so operators see exactly what to fix in the boot log.
    await expect(
      import("../../app/api/auth/[...nextauth]/route")
    ).rejects.toThrow("NEXTAUTH_SECRET must be set");
  });
});

// ============================================================================
// Test 11 — device-control path validation (NC-1, v5 audit fix).
// `validatePath` is not exported, so we test via the public `readFile`
// API: a request for `/etc/passwd` must be rejected with the
// "Path not allowed" error message before any fs.readFileSync fires.
// On Windows, `path.resolve("/etc/passwd")` becomes `C:\etc\passwd`,
// which is also outside `ALLOWED_BASE` — so the test is cross-platform.
// ============================================================================
describe("11. device-control: validatePath rejects /etc/passwd (NC-1)", () => {
  it("readFile('/etc/passwd') is blocked with 'Path not allowed'", async () => {
    const { readFile } = await import("../../lib/device-control");
    const result = readFile("/etc/passwd");
    expect(result.success).toBe(false);
    expect(result.action).toBe("read_file");
    // The exact ALLOWED_BASE depends on os.homedir() + env, but the
    // error message always starts with the literal "Path not allowed".
    expect(String(result.error)).toMatch(/Path not allowed/i);
    // Critical: must NOT mention /etc/passwd contents (i.e. must not
    // have actually read the file).
    expect(String(result.output ?? "")).not.toContain("root:");
  });

  it("readFile('<workspace>/../../etc/passwd') is also blocked (no `..` bypass)", async () => {
    const { readFile } = await import("../../lib/device-control");
    // `..` traversal — path.resolve collapses it to /etc/passwd, which
    // is outside ALLOWED_BASE. The startsWith check on the resolved
    // path catches this.
    const result = readFile(`${process.env.DEVICE_CONTROL_WORKSPACE || ""}/../../etc/passwd`);
    expect(result.success).toBe(false);
    expect(String(result.error)).toMatch(/Path not allowed/i);
  });
});

// ============================================================================
// Test 12 — DOMPurify print path (NC-2, v5 audit fix). The printReport
// function in deep-research.tsx builds an HTML document with
// `DOMPurify.sanitize(marked.parse(report))`. marked preserves raw HTML
// in markdown (so a `<script>` in the report survives the markdown
// pass); DOMPurify is the security boundary that strips it before
// innerHTML assignment. This test simulates that chain — marked is
// loaded via CDN at runtime so we mock its output as the identity on
// raw-HTML payloads (which is what marked actually does for inline HTML).
// ============================================================================
describe("12. DOMPurify print path: strips <script> from marked.parse output (NC-2)", () => {
  beforeAll(async () => {
    // DOMPurify needs a DOM. In Node we provide jsdom. Reuse the
    // window/document set up by test 4 if it ran first; otherwise
    // initialize fresh.
    if (typeof globalThis.window === "undefined") {
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
      (globalThis as unknown as { window: unknown }).window = dom.window;
      (globalThis as unknown as { document: Document }).document =
        dom.window.document;
    }
  });

  it("marked-style raw HTML payload with <script> is sanitized to safe HTML", async () => {
    const { default: DOMPurify } = await import("dompurify");
    // Simulate marked.parse() output for a markdown source containing
    // an inline <script>. marked passes raw HTML through unchanged
    // (it does NOT escape or strip inline HTML by default — that's
    // why DOMPurify is required downstream).
    const markedOutput =
      '<h1>Report</h1>\n' +
      '<p>Some findings.</p>\n' +
      '<script>alert("exfiltrate")</script>\n' +
      '<img src="x" onerror="alert(1)">';

    // printReport calls `DOMPurify.sanitize(marked.parse(report))`
    // with NO options — the default config strips <script> tags and
    // on* event-handler attributes.
    const clean = DOMPurify.sanitize(markedOutput);

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain('alert("exfiltrate")');
    // Safe content survives.
    expect(clean).toContain("<h1>Report</h1>");
    expect(clean).toContain("Some findings.");
  });
});

// ============================================================================
// Test 13 — CORS localhost blocked in production (NM-1, v5 audit fix).
// The `isAllowedOrigin` function in src/proxy.ts gates the localhost
// array on `process.env.NODE_ENV !== "production"`. In production, an
// Origin: http://localhost:3000 header must NOT be allowed (a
// misconfigured prod deploy listening on localhost, or an attacker who
// tricks a user into visiting localhost, must not bypass CORS).
// We test via the exported `proxy()` function — the actual middleware
// entry point — by constructing a NextRequest with a localhost Origin
// and asserting the response is 403.
// ============================================================================
describe("13. CORS: localhost Origin blocked in production (NM-1)", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const env = process.env as unknown as Record<string, string | undefined>;

  afterEach(() => {
    // Restore env so subsequent tests get vitest defaults.
    if (origNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = origNodeEnv;
    if (origAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = origAllowedOrigins;
    // Reset the module cache so the next test re-imports proxy.ts
    // under the (potentially changed) env. proxy.ts reads
    // process.env.NODE_ENV inside the function body (not at module
    // load), but resetting keeps the test isolated.
    vi.resetModules();
  });

  it("rejects Origin: http://localhost:3000 with 403 in production", async () => {
    env.NODE_ENV = "production";
    // Make sure ALLOWED_ORIGINS doesn't include "*" — that would
    // bypass the localhost check entirely (the "*" branch is tested
    // separately in fix #4).
    delete process.env.ALLOWED_ORIGINS;

    const { proxy } = await import("../../proxy");
    const req = new NextRequest("https://example.com/api/research/start", {
      method: "POST",
      headers: {
        // Basic Auth bypasses the CSRF gate so we reach the origin
        // check (which is what we're testing).
        authorization: "Basic dXNlcjpwYXNz",
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: "{}",
    });
    const res = await proxy(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(String(body.error).toLowerCase()).toContain("origin");
  });

  it("allows Origin: http://localhost:3000 in dev (non-production)", async () => {
    env.NODE_ENV = "development";
    delete process.env.ALLOWED_ORIGINS;

    const { proxy } = await import("../../proxy");
    const req = new NextRequest("https://example.com/api/research/start", {
      method: "POST",
      headers: {
        authorization: "Basic dXNlcjpwYXNz",
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: "{}",
    });
    const res = await proxy(req);
    // Dev allows localhost — should pass through (status 200 from
    // NextResponse.next()).
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000"
    );
  });
});

