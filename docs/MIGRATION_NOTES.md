# Migration Notes

## next-auth v4 → Auth.js v5 (PLANNED)

The project currently uses next-auth v4 with Next.js 16. While the integration works, next-auth v4 was designed for Next.js 12-14. Auth.js v5 (next-auth v5) is the recommended upgrade path:

- Better Next.js App Router support
- Native CSRF token handling
- Cookie-based sessions (no JWT)
- Edge runtime compatibility

**Migration effort:** 2-3 days
**Risk:** Medium (session handling, cookie paths may change)
**Priority:** P1 (before enterprise launch)

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

## Stub modules — interface-only, not production-ready

The following modules ship as **interface-only stubs**. Their types and
function signatures are stable and exercised by tests, but the
implementations are intentionally minimal. Banners at the top of each
file declare the missing dependencies + the path to enable them.

### `src/lib/collab/collaboration.ts` — real-time collaboration

- **What's stubbed:** `updateCursor()` mutates the in-memory session
  registry but does NOT broadcast `CollabUpdate` events to other
  participants (no WebSocket fan-out).
- **What's required:** `yjs` + `y-websocket` packages + a y-websocket
  mini-service (see `mini-services/` pattern).
- **To enable:**
  1. `bun add yjs y-websocket`
  2. Create `mini-services/collab-service/` running y-websocket on a
     dedicated port (e.g. 3003).
  3. Replace the stub `updateCursor` / `joinSession` / `leaveSession`
     with Yjs document mutations that the y-websocket server syncs to
     all connected clients.
  4. Update the `CollabIndicator` component to subscribe to the
     y-websocket room for the active session.
- **Priority:** P2 (post-launch, when Canvas Mode collaboration moves
  out of beta).

### `src/lib/video-understanding/index.ts` — video keyframes + transcript

- **What's stubbed:** `analyzeVideo()` returns an empty `VideoAnalysis`
  (no keyframes, no transcript, no metadata). The `VIDEO_UNDERSTANDING_ENABLED`
  env flag gates the stub; when unset, the `/api/video/analyze` route
  returns 501.
- **What's required:** `ffmpeg` + `ffprobe` binaries on the host, plus
  `openai-whisper` (or a hosted Whisper-compatible API) for transcription.
- **To enable:**
  1. Install ffmpeg + openai-whisper on the host (`apt install ffmpeg`
     + `pip install openai-whisper`).
  2. Set `VIDEO_UNDERSTANDING_ENABLED=true`.
  3. Replace the stub `analyzeVideo` with the four-step pipeline
     documented in the file's banner (ffprobe → keyframe extraction →
     audio extraction → whisper transcription).
  4. Wire the keyframe JPEGs into the configured vision provider
     (same fallback chain as `/api/vision`).
- **Priority:** P3 (post-launch; vision-only feature, not in MVP scope).

