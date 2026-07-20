# Migration Notes

## next-auth v4 → Auth.js v5 (PLANNED — last verified 2026-07-20)

The project currently uses **next-auth v4.24.14** (latest stable v4 patch)
with Next.js 16. While the integration works, next-auth v4 was designed
for Next.js 12-14 and is in maintenance-only mode. Auth.js v5 (next-auth
v5) is the recommended upgrade path:

- Better Next.js App Router support (native route handlers, no
  `[...nextauth]/route.ts` wrapper).
- Native CSRF token handling (replaces our hand-rolled rate-limit shim
  on POST).
- Cookie-based sessions (no JWT — eliminates the `NEXTAUTH_SECRET`
  fail-closed check at module load).
- Edge runtime compatibility (the auth route can run on edge instead
  of nodejs).
- Eliminates the bundled `uuid@3` advisory (next-auth v5 ships without
  the legacy uuid dependency).

**Why we are NOT migrating today (2026-07-20):**
1. Auth.js v5 is still in **beta** (latest `5.0.0-beta.31`). The stable
   release is tracked at https://github.com/nextauthjs/next-auth/issues.
   Awaiting 5.0.0 stable before taking the breaking change in a
   production codebase.
2. The v5 API is a **MAJOR breaking change** — see "Migration steps"
   below. The route handler signature, the session callback shape, and
   the `signIn`/`signOut` client API all change.
3. The 503 tests cover the existing v4 surface (`authOptions`,
   `rateLimitedHandler`, `findUserByEmail`, `rehashPasswordIfNeeded`).
   A v5 migration would invalidate ~12 of these tests and require
   re-writing them against the v5 `auth()` helper.
4. CVE impact: the 3 high CVEs the audit repeatedly flags are all in
   **transitive dev/build dependencies** of next-auth v4 (eslint's
   `flatted`, `picomatch`, `minimatch`; see the dependency-vulnerabilities
   section below). None reach the production runtime bundle. The
   `uuid@3` advisory (next-auth's bundled copy) only affects
   `uuid.v3`/`v5` with the `buf` argument — next-auth never passes
   `buf`, so the vulnerable path is unreachable in our usage.

**Migration effort:** 2-3 days
**Risk:** Medium (session handling, cookie paths may change)
**Priority:** P1 (before enterprise launch)
**Blocker:** Auth.js v5 stable release (currently beta)

### Migration steps (when v5 stable ships)

1. **Bump the dependency:**
   ```bash
   bun remove next-auth
   bun add next-auth@beta   # or @auth/core once v5 stable
   ```

2. **Create `src/auth.ts`** (replaces `authOptions` export):
   ```ts
   import NextAuth from "next-auth";
   import Credentials from "next-auth/providers/credentials";

   export const { handlers, auth, signIn, signOut } = NextAuth({
     providers: [
       Credentials({
         credentials: { email: {}, password: {} },
         async authorize(credentials) {
           // Move findUserByEmail + bcrypt.compare + rehashPasswordIfNeeded
           // here — same body as the v4 authorize() function.
         },
       }),
     ],
     session: { strategy: "jwt" },
     pages: { signIn: "/login" },
     callbacks: {
       // Same jwt/session callbacks as v4 — the shape is identical.
       async jwt({ token, user }) { if (user) token.userId = user.id; return token; },
       async session({ session, token }) {
         if (session.user) session.user.id = token.userId as string;
         return session;
       },
     },
   });
   ```

3. **Replace `src/app/api/auth/[...nextauth]/route.ts`** with:
   ```ts
   import { handlers } from "@/auth";
   export const { GET, POST } = handlers;
   ```
   - The `rateLimitedHandler` wrapper around POST should move to a
     middleware pattern (or wrap `handlers.POST` directly — same
     `checkStartRateLimit`/`releaseConcurrency` calls).
   - The `NEXTAUTH_SECRET` fail-closed check at module load can be
     removed — v5 reads `AUTH_SECRET` (renamed) and fails loudly if
     unset in production. Keep our explicit check as defense-in-depth
     if desired.

4. **Update client `signIn`/`signOut` imports:**
   - `import { signIn } from "next-auth/react"` still works in v5
     (the `next-auth/react` export is preserved).
   - Server-side `signIn`/`signOut` now come from `@/auth` (above).

5. **Update the SessionProvider wrapper** — no change needed; v5's
   `SessionProvider` is API-compatible with v4.

6. **Re-run the test suite.** Tests that reference `authOptions`
   directly will need to be updated to reference the v5 config object
   (export it from `src/auth.ts` for testability). The route handler
   tests should pass unchanged because the HTTP surface (GET/POST on
   `/api/auth/*`) is identical.

7. **Update the OpenAPI spec** — the `/api/auth/[...nextauth]` path
   stays the same; no spec changes needed.

8. **Remove `NEXTAUTH_SECRET` from `.env.example`** and replace with
   `AUTH_SECRET` (v5 renamed env var). The dev-fallback warning in
   `route.ts` moves to `src/auth.ts`.

9. **Re-audit `bun audit`** — the `uuid@3` advisory should clear
   (next-auth v5 drops the uuid dependency).

## bcryptjs → bcrypt (PLANNED)

bcryptjs is pure JS (3x slower than native bcrypt). Migration:
- Replace `import bcrypt from "bcryptjs"` with `import bcrypt from "bcrypt"`
- Add `bcrypt` as dependency, remove `bcryptjs`
- Rehash all existing passwords on next login (compare with both, rehash with native)

**Migration effort:** 1 day
**Priority:** P2 (performance improvement)

### bcrypt cost factor 10 → 12 (DONE — v6 audit fix)

The OWASP password-storage cheat sheet recommends bcrypt cost factor
**12** (or higher — pick the highest value your auth latency budget
allows). The codebase previously used cost **10**, which was the
bcryptjs default but is now below the OWASP floor.

**Completed in the v6 audit fix pass:**

1. `src/app/api/auth/register/route.ts` — `bcrypt.hash(password, 10)`
   → `bcrypt.hash(password, 12)`. All new account registrations get
   the upgraded cost factor.
2. `src/app/api/auth/reset-password/route.ts` — same change. All
   password resets get the upgraded cost factor.
3. `src/app/api/auth/[...nextauth]/route.ts` — added a
   `rehashPasswordIfNeeded(userId, email, password, hash)` helper
   called from the NextAuth credentials `authorize()` callback after
   a successful `bcrypt.compare`. It parses the bcrypt hash's cost
   factor (from `$2a$<cost>$<salt><hash>` → `Number(parts[2])`) and,
   if the cost is below 12, re-hashes the just-verified plaintext
   password at cost 12 and persists it via the same Postgres →
   SQLite fallback pattern as `findUserByEmail`. Failures are
   non-fatal (login still succeeds; the rehash is retried next time).

**Result:** legacy hashes at cost 10 are transparently upgraded
incrementally (no offline batch rehash required). Within one login
window of every active user returning to the app, the entire user
table is on cost 12. Inactive users keep their cost-10 hash (still
secure, just below the OWASP floor) until they next sign in.

**Native bcrypt migration (bcryptjs → bcrypt):** still PLANNED. The
rehash-on-login mechanism above is forward-compatible — when the
native `bcrypt` package replaces `bcryptjs`, the same
`rehashPasswordIfNeeded` helper can additionally detect a
`$2a$`-prefix hash (bcryptjs default) and rehash using `$2b$`
(native bcrypt default) on next login, with no further code changes.

## Dependency vulnerabilities — `bun audit` results (2026-07-19, fix-7-remaining)

`bun update` was run to bring all compatible-range deps to the latest
within their declared semver range. This reduced the count from **20**
vulnerabilities (10 high, 9 moderate, 1 low) to **18** (10 high, 7
moderate, 1 low). The remaining 18 are **all in dev-only or build-time
transitive dependencies** — none ship in the production runtime bundle.
They cannot be auto-fixed without breaking changes to upstream packages
(`bun update --latest` would force major bumps on eslint / react-email /
exceljs / vitest / @sentry/nextjs / @modelcontextprotocol/sdk / prisma /
mermaid / next-auth). Documented here so operators can decide whether /
when to take the breaking upgrades.

### Per-package status (18 remaining)

| Package | Severity | Reaches prod runtime? | Notes / blocker |
|---|---|---|---|
| `@hono/node-server` <1.19.13 | moderate | No | Transitive via `@modelcontextprotocol/sdk` (dev-only at runtime) + `prisma/@prisma/dev` (build/dev). Upgrade blocked on `@modelcontextprotocol/sdk` releasing a minor that bumps `@hono/node-server`. |
| `brace-expansion` <1.1.13 | moderate | No | Transitive via `eslint`, `react-email`, `@sentry/nextjs` (build), `exceljs` (used server-side for xlsx generation — but `brace-expansion` only loads if `exceljs`'s `archiver` walks a glob, which our usage does NOT trigger). |
| `postcss` <8.5.10 | moderate | No | Transitive via `@tailwindcss/postcss` + `next` (build), `vitest` (test), `@sentry/nextjs` webpack-plugin (build). Build-time only. |
| `uuid` <11.1.1 | moderate | Partial (next-auth) | `next-auth` ships its own copy of `uuid@3` (v3/v5/v6 only affected when `buf` arg is provided — next-auth never passes `buf`). `exceljs`/`mermaid` are server-side but the vulnerable code path is unreachable in our usage. Upgrade blocked on `next-auth` v5 (see "next-auth v4 → Auth.js v5" above) which removes the `uuid` dependency entirely. |
| `@babel/core` <=7.29.0 | low | No | Transitive via `@sentry/nextjs` bundler-plugin (build-time source-map upload) + `eslint-plugin-react-hooks` (dev). The "arbitrary file read via sourceMappingURL" path requires the attacker to control a `.js` file's `sourceMappingURL` comment AND the build to read it — our build only consumes our own source. |
| `minimatch` <3.1.3 | high | No | Transitive via `eslint`, `react-email`, `@sentry/nextjs` build, `exceljs`'s `archiver`. ReDoS requires attacker-controlled glob pattern — our usage does not pass user input to minimatch. |
| `flatted` <3.4.0 | high | No | Transitive via `eslint`'s `file-entry-cache` (lint cache). Dev-only. |
| `picomatch` <2.3.2 | high | No | Transitive via `vitest`, `@sentry/nextjs` build, `eslint-config-next`'s `typescript-eslint`. Dev/build only. |
| `js-yaml` >=4.0.0 <=4.1.1 | moderate | No | Transitive via `eslint`'s `@eslint/eslintrc`. Dev-only. |

### Action plan

1. **next-auth v5 migration** (P1, tracked above) — eliminates `uuid` and
   `@hono/node-server`-via-next-auth advisories.
2. **eslint upgrade** (P2) — when eslint 10 stabilises, the `flatted`,
   `picomatch`-via-eslint, `minimatch`-via-eslint, `js-yaml`-via-eslint
   and `brace-expansion`-via-eslint advisories all clear.
3. **exceljs replacement** (P3) — `exceljs` is the only server-side dep
   that pulls in `minimatch`/`brace-expansion`/`uuid`. Consider migrating
   to a lighter xlsx writer (e.g. `write-excel-file` or hand-rolled
   XML) for the file-generation route.
4. **No runtime exposure today** — the production standalone build
   (`.next/standalone/server.js`) does not bundle any of the listed
   packages. The advisories are documented for hygiene and to drive the
   upstream upgrade cadence; they are NOT exploitable in the current
   deployment shape.

### Re-audit command

```bash
bun audit          # list current vulns
bun update         # bump compatible-range deps (non-breaking)
bun update --latest # major bumps — review CHANGELOGs first
```

## Stub modules — status (v4.1.0 final-10 cleanup)

As of v4.1.0 (2026-07-20), the previously-shipped interface-only stubs
have been pruned. The original stub bodies lived in two files:

### `src/lib/collab/collaboration.ts` — DELETED (v4.1.0)

This was the high-level cursor/presence interface stub for real-time
collaboration (Yjs + y-websocket). It was never imported by any
caller — the production collaboration HTTP API
(`/api/collab/[sessionId]`) uses `src/lib/collab/collab-server.ts`
directly, which has a real working in-memory session registry (not
a stub). The high-level cursor interface was dead code.

The file has been deleted. No imports to clean up (verified by grep
before deletion). The `CollabIndicator` component is a pure view
component that takes `participants` as a prop — it does not import
the deleted module.

If real-time cursor sharing is required in the future:

1. `bun add yjs y-websocket`
2. Create `mini-services/collab-service/` running y-websocket on a
   dedicated port (e.g. 3003).
3. Implement `updateCursor` / cursor broadcast in the y-websocket
   mini-service. The `collab-server.ts` session registry already
   tracks participants — the y-websocket layer just needs to fan
   out cursor updates to the connected clients in each session.
4. Update the `CollabIndicator` component to subscribe to the
   y-websocket room for the active session.

**Priority:** P3 (post-launch; not in MVP scope).

### `src/lib/video-understanding/index.ts` — minimal "Not implemented" stub (v4.1.0)

The previous stub returned empty `VideoAnalysis` results from
`analyzeVideo()` (no keyframes, no transcript, no metadata). This
gave callers the illusion of a working interface while delivering
no value.

As of v4.1.0, the stub has been reduced to a **"Not implemented"
stub**:

- `isVideoUnderstandingAvailable()` always returns `false`.
- `analyzeVideo()` throws `"Not implemented: video understanding
  requires ffmpeg + Whisper"`.
- `extractKeyframes()` / `transcribeVideo()` / `buildVideoPrompt()`
  throw the same error.
- Type exports (`VideoKeyframe`, `VideoTranscript`, `VideoScene`,
  `VideoAnalysis`, `AnalyzeVideoOptions`) are preserved so the API
  route (`/api/video/analyze`) compiles without changes.
- `VIDEO_CONFIG` is preserved as informational constants.

The API route's existing availability gate (`if
(!isVideoUnderstandingAvailable()) return 503`) means callers receive
a clean 503 ("Video understanding is not available on this server")
WITHOUT ever hitting the throw. The throw is defensive — if a future
caller invokes `analyzeVideo` directly, they get a clear error.

To re-enable (future milestone):

1. Install ffmpeg + openai-whisper on the host (`apt install ffmpeg`
   + `pip install openai-whisper`).
2. Set `VIDEO_UNDERSTANDING_ENABLED=true`.
3. Restore `isVideoUnderstandingAvailable` to honour the env flag
   (return `process.env.VIDEO_UNDERSTANDING_ENABLED === "true"`).
4. Replace the `analyzeVideo` body with the four-step pipeline
   (ffprobe → keyframe extraction → audio extraction → whisper
   transcription). The original stub body is in git history.
5. Wire the keyframe JPEGs into the configured vision provider
   (same fallback chain as `/api/vision`).

**Priority:** P3 (post-launch; vision-only feature, not in MVP scope).

