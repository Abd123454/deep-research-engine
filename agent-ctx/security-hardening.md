# Task security-hardening — Agent Work Record

**Agent:** security-hardening
**Task ID:** security-hardening
**Scope:** 4 security-hardening fixes from the independent audit.
**Status:** ✅ Complete

## Mission

Implement 4 fixes flagged by the independent audit:
1. Disable code sandbox by default in BOTH dev and prod (was dev-open) + warning banner
2. CSRF utility for the future cookie-auth migration
3. IP allowlist for sensitive admin routes (`/api/mcp`, `/api/audit-logs`)
4. Provider/model/region disclosure in the chat SSE stream + ChatCard UI

## Files Touched

### Created
- `src/lib/csrf.ts` — `validateCsrf(req)` + `issueCsrfToken()`. No-op for
  current Basic-Auth / Bearer (API-key) traffic; double-submit-cookie
  enforcement ready for the future NextAuth/cookie migration. Uses
  constant-time compare.

### Modified
- `src/lib/code-sandbox.ts`
  - Added `export const CODE_EXEC_ENABLED = process.env.ENABLE_CODE_EXEC === "true"`
  - Added `CODE_EXEC_DISABLED_ERROR` constant
  - `runCode()` now checks `CODE_EXEC_ENABLED` regardless of `NODE_ENV`
  - One-shot `logger.warn` ASCII banner at module load when disabled
  - File header rewritten to reflect default-off behavior

- `src/lib/auth.ts`
  - Added `ADMIN_ROUTES = ["/api/mcp", "/api/audit-logs"]`
  - New `requireAdminAccess(req)` export — exact-IP-match check against
    `ADMIN_IP_ALLOWLIST` env var (CIDR matching intentionally NOT
    implemented per audit recommendation). No-op when env var unset.

- `src/app/api/mcp/route.ts`
  - Both `POST(req)` and `GET(req)` (signature changed from parameterless)
    now call `requireAdminAccess(req)` at the top before any other logic

- `src/app/api/audit-logs/route.ts`
  - `requireAdminAccess(req)` invoked before `requireAuth(req)`

- `src/lib/llm-provider.ts`
  - New `ProviderDisplayInfo` interface and `getProviderDisplayInfo(provider)`
    helper: nvidia→US, openai→US, anthropic→US, ollama→local, default→unknown

- `src/app/api/chat/route.ts`
  - Imports `getProviderDisplayInfo`
  - Emits a `meta` SSE event BEFORE the first token with expected
    provider/model/region
  - `done` event now also carries actual provider/providerDisplayName/
    region/model (corrects attribution if cross-provider fallback fired)

- `src/components/cards/ChatCard.tsx`
  - New `ProviderAttribution` interface + `providerInfo` state
  - New `providerSubtitle` memo: `<model> via <Provider> (<region>)`
  - Parses both `meta` and `done` events to populate `providerInfo`
  - Renders `Quaesitor · <subtitle>` next to assistant label on the
    most-recent message and during streaming
  - Subtitle uses saddle-brown tones (`#8b6f47` light, `#b8946a` dark),
    `truncate` + `title=` tooltip for long model names
  - Only the most-recent assistant message is annotated; history keeps
    bare "Quaesitor"

- `.env` — added `ENABLE_CODE_EXEC=true` so the local dev/test env
  (loaded by `vitest.config.ts`) keeps the existing code-sandbox tests
  passing. The `.env` is gitignored; the *default* (no env var) is
  disabled — which is what the audit requires.

- `.env.example` — documented `ENABLE_CODE_EXEC` (default-off) and the
  new `ADMIN_IP_ALLOWLIST` knob with cross-references to SECURITY.md
  and `src/lib/code-sandbox-docker.ts`.

## Key Design Decisions

### Code sandbox: default-off in BOTH dev and prod
The old guard was `NODE_ENV === "production" && ENABLE_CODE_EXEC !== "true"`,
which left dev mode wide open. The vm fallback is NOT a security boundary
(per Node's own docs), so any local request could run arbitrary user code.
New guard: `if (!CODE_EXEC_ENABLED) return disabled-error;` — same rule
for dev and prod.

To keep the existing 14 `code-sandbox.test.ts` tests passing without
modifying them, set `ENABLE_CODE_EXEC=true` in `.env`. The vitest config
loads `.env` via `dotenv`. This is a local convenience; the *default*
(no env var) is disabled, matching the audit's requirement.

### CSRF: dormant utility
Quaesitor uses HTTP Basic Auth. Browsers don't auto-attach Basic creds
cross-origin, so classic CSRF doesn't apply. The `validateCsrf(req)`
function is a no-op for any request with an `Authorization: Basic ...`
or `Authorization: Bearer ...` header. It only enforces the
double-submit-cookie pattern for cookie-authenticated requests — which
Quaesitor doesn't have yet. The module is ready for the NextAuth
migration; not currently wired into any route handler.

### IP allowlist: opt-in via env var
`requireAdminAccess(req)` is a no-op when `ADMIN_IP_ALLOWLIST` is unset,
preserving existing behavior. When set, it gates `/api/mcp` and
`/api/audit-logs` behind an exact-IP-string match. CIDR matching is
intentionally NOT implemented — operators needing CIDR should normalize
egress IPs at the reverse-proxy layer (Caddy/Nginx). Called BEFORE
`requireAuth` so the IP check fires even when no credentials are sent
(defense in depth).

### Provider disclosure: two-layered (meta + done)
The chat SSE stream now emits:
1. `data: {"type":"meta","provider":"...","providerDisplayName":"...","region":"...","model":"...","expected":true}`
   — BEFORE the first token, with the EXPECTED provider (immediate UI
   feedback).
2. The `done` event now also carries `provider`, `providerDisplayName`,
   `region`, `model` from the actual `result` — corrects the attribution
   if cross-provider fallback (NVIDIA → OpenAI → Anthropic → Ollama)
   fired mid-stream.

This is backwards-compatible: old clients ignore the `meta` event and
the new `done` fields. The ChatCard UI updates `providerInfo` state on
both events; the `done` event's value overwrites the `meta` event's.

The audit explicitly allowed the "add to done event" fallback if wiring
a separate meta event was too complex. I did BOTH — meta for instant
feedback, done for accuracy. This gives the best UX without breaking
the SSE format.

### Region mapping
- nvidia → "US" (NVIDIA NIM at `integrate.api.nvidia.com` is US-hosted)
- openai → "US" (default `api.openai.com`)
- anthropic → "US" (default `api.anthropic.com`)
- ollama → "local" (self-hosted on operator's server)

Operators with custom `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` pointing
to a non-US region should extend the `getProviderDisplayInfo` switch.

## Type / Lint / Tests

```
bunx tsc --noEmit --strict   → 0 errors
bun run lint                  → 0 errors (5 pre-existing warnings in
                                unrelated files: projects/page.tsx,
                                multi-modal/generators.ts — predate this
                                task and are noted in v4-rebrand's log)
bun run test                  → 446 passed | 1 skipped | 0 failed
                                (code-sandbox tests pass because
                                 ENABLE_CODE_EXEC=true is set in .env)
```

## Quaesitor Color Discipline

No Claude/Anthropic colors introduced. The new ChatCard attribution
subtitle uses `#8b6f47` (saddle-brown tint consistent with the
existing `#8b4513` accent) in light mode and `#b8946a` (the existing
dark-mode accent) in dark mode. The skeleton-loader, form border, and
token counter reuse existing palette tokens unchanged.

## Notes for Downstream Agents

- **Code execution is default-OFF.** Any new feature calling `runCode()`
  must handle the `CODE_EXEC_DISABLED_ERROR` gracefully. The eval
  runner's coding tests and the `/api/chat` agent's `run_code` tool
  already do. Don't reintroduce the dev-mode bypass.
- **CSRF module is dormant.** Don't call `validateCsrf(req)` from a
  route unless that route is reachable via cookie-based auth (currently
  none are). When the NextAuth migration lands, wire it up in every
  POST/PUT/PATCH/DELETE handler that authenticates via cookies.
- **`requireAdminAccess(req)` is a no-op by default.** Only kicks in
  when `ADMIN_IP_ALLOWLIST` is set. If you add a new admin-only route,
  append its path to `ADMIN_ROUTES` in `src/lib/auth.ts` and call
  `requireAdminAccess(req)` at the top of each handler before
  `requireAuth(req)`.
- **Provider disclosure is two-layered.** The `meta` event fires
  pre-stream with the EXPECTED provider; the `done` event corrects it
  with the ACTUAL provider post-stream. If you add a new SSE consumer
  for `/api/chat`, parse both events to avoid showing stale attribution
  when cross-provider fallback fires.
- **`getProviderDisplayInfo(provider)` lives in `src/lib/llm-provider.ts`.**
  If you add a new LLM provider (Mistral, Cohere, etc.), extend its
  switch statement. The fallback case returns
  `{ provider, displayName: provider, region: "unknown" }` so unknown
  providers don't crash the chat route.
- **`.env` now contains `ENABLE_CODE_EXEC=true`.** Local dev/test
  convenience. The `.env` is gitignored. Production deployments must
  decide explicitly whether to set this — default (unset) is disabled.
- **The `/api/mcp` GET handler signature changed** from `GET()` to
  `GET(req: NextRequest)`. Next.js doesn't care (passes `req`
  positionally), but direct test invocations need updating.

## Cross-references to Prior Work

- **`security-fixes` task** (see worklog): introduced `getUserId(req)`
  and `requireAuth(req)` in `src/lib/auth.ts`. This task adds
  `requireAdminAccess(req)` as a sibling guard, with the same
  middleware-style API (returns `NextResponse | null`).
- **`legal-docs` task** (see worklog): the Privacy Policy and RoPA
  cite "fail-closed authentication" — this task extends that posture
  to code execution (also default-off) and admin routes
  (allowlist-capable).
- **`v4-rebrand` task** (per agent-ctx): established the saddle-brown
  palette. This task's new ChatCard subtitle reuses `#8b4513`-family
  tones (`#8b6f47` / `#b8946a`), no Claude colors.

## Worklog

Appended to `/home/z/my-project/worklog.md` under
`## Task security-hardening — 4 Security Hardening Fixes (Audit Follow-up)`.
