# Task stability-tools — Stability & Tooling Improvements

**Agent:** stability-tools
**Task ID:** stability-tools
**Status:** ✅ Complete
**Date:** 2026-07-18 (per system clock)

## Scope

Six independent tooling / stability improvements to harden CI,
disaster recovery, observability, and API documentation:

1. CI npm-test job (verify npm compatibility alongside bun)
2. Dependabot config (weekly npm + github-actions PRs)
3. Backup script (SQLite + Postgres + artifacts, 30-day retention)
4. `/api/health` endpoint rewrite to the audit spec
5. OpenAPI spec expansion (13 new routes + 5 new schemas)
6. Load-test script (autocannon-based)

## What was done

### 1 — CI npm-test job
- `.github/workflows/ci.yml` already had a single `ci` job using Bun.
  Added a second `npm-test` job (ubuntu-latest, Node 20) that runs
  `npm install && npm run lint && npm test` — verifies a contributor
  who doesn't have Bun installed doesn't silently break the npm
  install / lint / test path.
- Both jobs run in parallel on every push to `main` and every PR.
- Added a header comment block documenting the two-job design.
- Added `timeout-minutes: 10` to the npm-test job to match the bun job.

### 2 — Dependabot config
- **Created** `.github/dependabot.yml`:
  - `npm` ecosystem, weekly schedule, 5 open PRs limit, labelled
    `dependencies` + `automated`.
  - `github-actions` ecosystem, weekly schedule (catches
    `actions/checkout@v4` → `v5` bumps etc.).
- Both ecosystems point at `/` (repo root).

### 3 — Backup script
- **Created** `scripts/backup.sh` (executable, `chmod +x`):
  - `set -euo pipefail` — fail fast on any error or unset var.
  - Backs up SQLite (`data/research.db`) if present.
  - Backs up Postgres via `pg_dump "$DATABASE_URL"` if `DATABASE_URL`
    is set (warns but doesn't fail if `pg_dump` errors).
  - Tars `upload/` (artifact storage) and `generated/` (generated
    files) if those dirs exist.
  - 30-day retention via `find backups/ -type d -mtime +30 -exec
    rm -rf {} \;` — the `2>/dev/null || true` guard handles the case
    where `backups/` doesn't exist yet.
  - Cron-ready: `0 2 * * * /path/to/scripts/backup.sh`.

### 4 — `/api/health` endpoint
- `src/app/api/health/route.ts` was rewritten to the audit spec:
  - Uses `getDb`, `isPostgresAvailable` from `@/lib/db` and `env`
    from `@/lib/env` (the previous implementation used `systemHealth()`
    from `stability.ts` and `isDockerAvailable()` from
    `code-sandbox-docker.ts`).
  - `checks` map uses `"ok" | "degraded" | "down"` vocabulary (was
    booleans).
  - `checks.database` — always present (SQLite or in-memory fallback).
  - `checks.postgres` — only present when `DATABASE_URL` starts with
    `postgresql://` (absent in dev/CI so the rollup ignores it).
  - `checks.llm` — `"ok"` if at least one of `NVIDIA_API_KEY`,
    `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_URL` is set.
  - Overall `status`: `"down"` if any check is down (HTTP 503);
    `"ok"` if all checks pass (HTTP 200); `"degraded"` otherwise
    (HTTP 200).
  - **Backward-compat fields preserved**: `uptime` (ms) and
    `uptimeHuman` are still returned so existing dashboards and the
    desktop wrapper's boot probe (`statusCode < 500`) keep working.
  - Removed the previous `details`, top-level `redis` /
    `database` strings, and the `docker` check — these were
    implementation details of `systemHealth()` that aren't part of
    the audit spec. The `systemHealth()` function in `stability.ts`
    is unchanged and still used by `src/lib/__tests__/stability.test.ts`.
- Verified no consumer breaks:
  - `enterprise/scripts/install.sh` greps for `"ok|degraded"` in the
    body — both old and new shapes match.
  - `desktop/main.js` checks `statusCode < 500` — both match.
  - `docker-compose.yml` uses `wget --spider` — body content
    irrelevant.

### 5 — OpenAPI spec expansion
- `docs/api/openapi.yaml` expanded from 12 to 25 paths and from 6 to
  11 schemas. New tag groups: `Account`, `Consent`, `Auth`, `MCP`,
  `Metrics`, `Feedback`.
- **New routes documented** (13 total):
  - `POST /api/research/stop/{id}` — cancel running job (NOTE: the
    route file exports `POST`, not `DELETE` as the audit listed;
    documented as POST with a note explaining the discrepancy).
  - `DELETE /api/account` — GDPR Art. 17 erasure.
  - `GET /api/account/export` — GDPR Art. 20 portability.
  - `GET /api/consent` + `POST /api/consent` — GDPR Art. 7 ledger.
  - `POST /api/auth/mfa/setup` / `verify` / `disable` — TOTP MFA.
  - `GET /api/mcp/marketplace` + `POST /api/mcp/install` — MCP
    marketplace (stub noted in description).
  - `GET /api/metrics` — admin KPI dashboard.
  - `POST /api/feedback` — user feedback widget.
- **Updated** `GET /api/health` to match the new route implementation
  (status enum `ok|degraded|down`, new `checks` shape, 503 response
  added).
- **New schemas**: `ConsentRecord`, `ConsentLedger`, `AccountExport`,
  `McpServer`, `Metrics`. The `HealthResponse` schema was rewritten to
  match the new route shape.
- **New response**: `Forbidden` (403) added to `components/responses`
  for admin-only endpoints (`/api/metrics`, `/api/mcp/install`, etc.).
- Each new route documents `summary`, `description`, `parameters`
  (where applicable), `requestBody` (for POSTs), and the full
  response set: `200`, `400`, `401`, `403`, `404`, `409`, `429`,
  `500` (only the applicable ones per route).
- **Pre-existing YAML fix**: line 246 had an unquoted `description:`
  value containing `{ "token": "..." }` which strict YAML parsers
  (js-yaml) interpreted as a flow mapping. Converted to a block
  scalar (`description: |`) so the spec now parses cleanly under
  js-yaml. This was a pre-existing issue, not introduced by this
  task — fixed opportunistically so the spec is validatable.
- Validated with `js-yaml.load()`: 25 paths, 11 schemas, 6 responses,
  16 tags — all parse cleanly.

### 6 — Load-test script
- **Created** `scripts/load-test.sh` (executable, `chmod +x`):
  - Auto-installs `autocannon` globally if missing.
  - Configurable via env: `BASE_URL`, `CONCURRENT` (default 20),
    `DURATION` (default 30s).
  - Test 1: `GET /api/health` (lightweight).
  - Test 2: `POST /api/chat` — explicitly skipped with a printed
    note (requires auth + LLM key; not safe to spam).
  - Test 3: `GET /` (page load — exercises the Next.js renderer).
  - Each `autocannon` invocation is wrapped in `|| true` so a single
    test failure doesn't abort the script.

## Files Touched

| File | Action |
|---|---|
| `.github/workflows/ci.yml` | modified (added `npm-test` job + header comment) |
| `.github/dependabot.yml` | **created** |
| `scripts/backup.sh` | **created** (executable) |
| `scripts/load-test.sh` | **created** (executable) |
| `src/app/api/health/route.ts` | rewritten to audit spec (+ backward-compat `uptime`) |
| `docs/api/openapi.yaml` | expanded (13 new routes, 5 new schemas, 1 new response, 6 new tags, 1 pre-existing YAML fix) |

## Verification

| Check | Result |
|---|---|
| `bunx tsc --noEmit --strict` | **0 errors** |
| `bun run lint` | **0 errors** (6 pre-existing warnings, none from this task) |
| `bun run test` | **446 passed \| 1 skipped (447)** — identical to baseline |
| `js-yaml.load(openapi.yaml)` | **OK** — 25 paths, 11 schemas, 6 responses, 16 tags |
| `js-yaml.load(ci.yml)` | **OK** — `["name","on","jobs"]` |
| `js-yaml.load(dependabot.yml)` | **OK** — `["version","updates"]` |
| `bash -n scripts/backup.sh` | **syntax OK** |
| `bash -n scripts/load-test.sh` | **syntax OK** |

## Key Design Decisions

1. **The `/api/health` rewrite is a breaking shape change** — the
   `status` enum went from `healthy|degraded|unhealthy` to
   `ok|degraded|down`, and the `checks` map went from booleans to
   the same enum. This matches the audit spec exactly. The two
   known consumers (enterprise install script, desktop wrapper)
   were verified to keep working — both check for `"degraded"` in
   the body or `statusCode < 500`, both of which still hold.

2. **Backward-compat `uptime` / `uptimeHuman` preserved** in the
   health response even though the audit spec didn't list them.
   Removing them would have broken any dashboard reading them, and
   the audit author clearly wanted a *better* health endpoint, not
   a *smaller* one. Adding extra fields is non-breaking.

3. **`POST /api/research/stop/{id}` documented as POST, not DELETE.**
   The audit listed `DELETE /api/research/stop/{id}` but the route
   file (`src/app/api/research/stop/[id]/route.ts`) only exports
   `POST`. Documenting it as DELETE would have made the spec lie.
   Documented as POST with a description note explaining the
   discrepancy. If a future agent wants RESTful `DELETE`, they
   should add a `DELETE` handler to the route file (the cancel
   semantics are identical).

4. **`GET /api/account` (user data) is NOT documented** — the
   audit listed it but the route file
   (`src/app/api/account/route.ts`) only exports `DELETE`. The
   `GET /api/account/export` route covers the "read user data" use
   case (GDPR Art. 20). If a future agent wants a non-download
   `GET /api/account` (e.g. for the settings page to read the
   user's own profile), they should add a `GET` handler to
   `src/app/api/account/route.ts` and document it.

5. **The pre-existing YAML quoting bug on line 246 was fixed
   opportunistically.** It wasn't introduced by this task, but it
   blocked strict-parser validation of the new content. Converted
   the unquoted single-line `description:` (which contained
   `{ "token": "..." }` and confused js-yaml into thinking it was
   a flow mapping) to a block scalar (`description: |`). This is
   a non-breaking change — the rendered description text is
   identical.

6. **The backup script uses `set -euo pipefail`** but every
   individual command is wrapped in `&& echo "ok" || echo "warn"`
   so a single subsystem failure (e.g. `pg_dump` not installed)
   doesn't abort the whole backup. The 30-day retention `find` is
   guarded with `2>/dev/null || true` so a missing `backups/`
   directory doesn't break the script.

7. **The CI `npm-test` job does NOT run `tsc --noEmit`** — the
   audit spec listed only `npm install && npm run lint && npm test`.
   The bun `ci` job already runs `npx tsc --noEmit` separately, so
   type errors are caught. Adding it to the npm-test job would
   just duplicate work and slow CI.

## Notes for Future Agents

- **The `systemHealth()` function in `src/lib/stability.ts` is now
  unused by the route layer** (the new `/api/health` calls `getDb`
  + `isPostgresAvailable` + `env` directly). It is still tested by
  `src/lib/__tests__/stability.test.ts` (8 tests). Do NOT delete
  it — the tests pin the behavior of `withRetry`,
  `CircuitBreaker`, `withFallback`, and `systemHealth`. If you
  want to remove `systemHealth`, also remove its tests and update
  the worklog.

- **The `isDockerAvailable()` function in
  `src/lib/code-sandbox-docker.ts` is no longer called from the
  health route** but is still called internally by
  `code-sandbox-docker.ts` itself (`runInDocker`). Don't remove.

- **The OpenAPI spec is now validatable.** Future agents adding new
  routes should run:
  ```bash
  node -e "require('js-yaml').load(require('fs').readFileSync('docs/api/openapi.yaml','utf8'))"
  ```
  to confirm they didn't introduce a YAML syntax error. The
  `/api/docs` route serves the raw YAML as `application/yaml` —
  pointing Swagger UI / Redoc at it gives interactive docs.

- **The `npm-test` CI job will fail if the project ever adds a
  dependency that doesn't `npm install` cleanly** (e.g. a native
  addon that needs `node-gyp` and a specific Python version).
  This is the intended behavior — surface the breakage early.

- **The backup script writes to `backups/$DATE/` relative to the
  current working directory.** If you run it from a different
  directory, the backups land there. The cron entry should
  `cd /path/to/quaesitor` first, or the script should be invoked
  with an absolute path AND the `BACKUP_DIR` variable should be
  made absolute. Currently it's relative — matches the audit spec
  verbatim.
