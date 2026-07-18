# p1-device-control — 3 P1 Features (Device Control Agent + Connectors Framework + Mobile Scaffold)

**Task ID:** p1-device-control
**Agent:** p1-device-control
**Date:** 2026-07-18
**Outcome:** SUCCESS — All 3 features landed. `tsc` 0 errors, `lint` 0 errors / 0 warnings, `test` 451 passed / 1 skipped (unchanged from baseline).

This agent read prior work records in `/agent-ctx/` before starting (notably `p1-platform.md`, `fix-5-vulns.md`, `deep-security-audit.md`) to align with the existing audit-log conventions, `requireAuth + getUserId + logSensitiveAction` route pattern, and the dual-mode DB pattern.

## What was implemented

### FEATURE 1 — Device Control Agent (Windows/macOS/Linux)

**Files changed:** `src/lib/device-control/index.ts` (new), `src/lib/swarm.ts` (role added), `src/lib/agent-tools.ts` (tool added), `src/lib/audit.ts` (sensitive action added), `src/app/api/device-control/route.ts` (new), `src/lib/__tests__/agent-tools.test.ts` (count updated), `src/lib/__tests__/react-agent.test.ts` (count updated).

#### 1a. Device Control Library — `src/lib/device-control/index.ts`
Cross-platform device management library. Pure library — never auto-executes anything. All 16 actions are invoked explicitly by an authenticated caller via `/api/device-control`.

- **16 actions** enumerated in `DeviceAction` type + `DEVICE_ACTIONS` allow-list: `system_info`, `list_files`, `read_file`, `write_file`, `delete_file`, `create_directory`, `execute_command`, `install_package`, `list_processes`, `kill_process`, `network_status`, `disk_usage`, `env_vars`, `open_url`, `clipboard_read`, `clipboard_write`.
- **`detectOS()`** returns `"windows" | "macos" | "linux"` based on `process.platform`. Every command-builder branches on this.
- **`executeCommand()`** wraps `execSync` with: 30s default timeout, 1MB maxBuffer, output capped at 10k chars, error message capped at 1k chars. Uses `powershell.exe` on Windows and `/bin/bash` elsewhere as the shell.
- **Per-action wrappers** (`listFiles`, `readFile`, `writeFile`, `installPackage`, `listProcesses`, `killProcess`, `networkStatus`, `diskUsage`, `openUrl`, `clipboardRead`, `clipboardWrite`) each pick the OS-appropriate shell command. Package install tries `winget` (Windows), `brew` (macOS), and apt→dnf→pacman fallback chain (Linux).
- **`executeDeviceAction(action, params)`** is the main dispatcher used by both the API route and the agent tool. Returns `DeviceActionResult` with `success`, `output` (or `error`), `action`, `os`, `timestamp`.
- **`isDeviceAction(value)`** type guard — used by the API route and the agent tool to validate the action against the allow-list before dispatching.
- The original spec's `import { execSync, exec } from "child_process"` had an unused `exec` import — removed to keep `@typescript-eslint/no-unused-vars` clean. Only `execSync` is used (the spec's other functions are all synchronous).

#### 1b. Device Controller Role — `src/lib/swarm.ts`
Added `device_controller` to the swarm as a 10th agent role (alongside `researcher`, `coder`, `analyst`, `writer`, `generalist`, `security_analyst`, `electrical_engineer`, `fact_checker`, `bias_auditor`).

- **`AgentRole`** type union extended with `"device_controller"`.
- **`ROLE_PROMPTS.device_controller`** — full system prompt enumerating the 9 capability areas + 6 security rules + 5-step execution protocol. The security rules forbid: deleting system files, running destructive commands (`rm -rf /`, `format`), accessing files without permission, and acting without user confirmation on destructive ops.
- **`ROLE_TOOLS.device_controller`** = `["device_control"]` — the role can ONLY call the device_control tool. It cannot web_search or run_code (defense in depth — the role's job is device management, not research).
- **`PLAN_SYSTEM_PROMPT`** updated to list the new role so the Orchestrator can pick it for device-management tasks.
- **`validateRole()`** updated to accept `"device_controller"` so the LLM-emitted role string is accepted (otherwise it falls back to `generalist`).

#### 1c. Device Control API Route — `src/app/api/device-control/route.ts`
`POST /api/device-control` with body `{ action: DeviceAction, params: Record<string, unknown> }`.

- **Auth**: `requireAuth(req)` + `getUserId(req)`. API-key auth (`requireApiKey`) is intentionally NOT supported — programmatic device control should go through a dedicated, separately-audited integration, not the user's personal API key.
- **Validation**: action must be in `DEVICE_ACTIONS` (400 otherwise); `params` must be a flat object (400 otherwise).
- **Audit logging**: `logSensitiveAction("device_control.action", userId, req, auditMetadata(action, params))`. The metadata includes `action` + a whitelist of safe fields (`path`, `command` capped at 500 chars, `package`, `pid`, `url` capped at 500 chars). The `content` / `text` fields (write_file, clipboard_write) are intentionally NOT logged — they can be large and contain sensitive data. The action's OUTPUT is also not logged (a `read_file` on `~/.ssh/id_rsa` must not land in the audit trail).
- **Runtime**: `nodejs` (not edge — device-control uses `child_process` / `fs` / `os`).
- **Error handling**: the library is designed to never throw — all errors are returned as `{ success: false, error }` in `DeviceActionResult`. The route's try/catch is defense-in-depth for unexpected failures (e.g. a native-module panic).

#### 1d. Device Control Tool — `src/lib/agent-tools.ts`
Added `device_control` to `AGENT_TOOLS` so the swarm's `device_controller` role can invoke it via the standard ReAct tool-call protocol.

- **Parameters**: `action` (string, required) + `params` (string, optional, JSON-encoded). The `params` field is declared as `string` so the LLM emits a JSON-encoded blob (matches the existing tool schema convention); the tool's `execute()` accepts both string and object forms for flexibility.
- **Validation**: rejects empty `action` with a clear error; rejects invalid `params` JSON with a parse-error message; rejects unknown actions with the full allow-list so the LLM can self-correct.
- **Dynamic import** of `./device-control` keeps the device-control module (which transitively pulls in `child_process` / `fs` / `os`) out of the test bundle. The agent-tools test suite mocks the LLM and code-sandbox; eagerly importing device-control would also eagerly import the dual-mode DB graph if audit logging is ever wired through here.
- **Test count updates**: two existing tests asserted the registry size was 3 (`agent-tools.test.ts` line 154: `expect(tools.length).toBe(3)` and `react-agent.test.ts` line 138: `expect(Object.keys(AGENT_TOOLS)).toHaveLength(3)`). Both updated to expect 4 (and the `agent-tools.test.ts` assertion now also checks `expect(tools).toContain("device_control")`). The test names were updated where they mentioned the count ("has 3 tools registered" → "has 4 tools registered"). No new test cases added.

#### 1e. Sensitive Action — `src/lib/audit.ts`
Added `"device_control.action": "device_control"` to `SENSITIVE_ACTIONS`. The comment block explains: every cross-platform device action is auditable, the action slug + target path / PID / command are recorded in metadata (whitelist), and the OUTPUT is intentionally NOT logged (size + privacy — a `read_file` on a private key must not land in the audit trail).

### FEATURE 2 — Connectors Framework (Slack/Notion/Drive/GitHub/Jira)

**Files changed:** `src/lib/connectors/index.ts` (new), `src/app/api/connectors/list/route.ts` (new).

#### `src/lib/connectors/index.ts`
Integration framework for external services. Deliberately a STUB at this stage: declares the OAuth2 flow shape + per-service config (client-id env var, scopes, auth URL template) but does NOT implement the actual OAuth2 callback or per-service search/fetch API calls.

- **`Connector` interface** — `type`, `name`, `icon` (Lucide name), `description`, `authRequired`, `capabilities`, `authUrl(state)`, `handleCallback(code)`, `search(query, token)`, `fetch(id, token)`. The last 3 are optional and unimplemented — they're declared so the interface shape is stable when the OAuth2 flow is wired up in a later milestone.
- **`AVAILABLE_CONNECTORS`** — 5 connectors: Slack (`search:read,channels:read`), Notion (`read,write`), Google Drive (`drive.readonly`), GitHub (`repo,read:user`), Jira (`read:jira-work`). Each `authUrl(state)` interpolates the appropriate `*_CLIENT_ID` env var (and `*_REDIRECT_URI` for Drive/Jira).
- **`getConnector(type)`** — lookup by type string.
- **`getConfiguredConnectors()`** — returns the subset whose client-id env var is set on the server. Used by the list endpoint so the UI can show "Connect Slack" (configured) vs "Slack (not configured)".
- The existing `src/lib/connectors/github.ts` (which has the actual `fetchRepoFiles` + `fetchFileContent` GitHub API calls) is unchanged — it's a different layer (the API client) from this framework (the OAuth2 catalog).

#### `src/app/api/connectors/list/route.ts`
`GET /api/connectors/list` — catalog endpoint. Returns the static catalog of supported connectors + a `configured` flag for each.

- **PUBLIC** (no auth required) — the catalog is not sensitive (same info appears in the marketing site). The actual connection (storing credentials) is handled by the existing `POST /api/connectors` route, which DOES require auth + project ownership verification.
- **Response shape**: `{ ok, connectors: Array<{ type, name, icon, description, authRequired, capabilities, configured }> }`.
- The `configured` boolean is itself non-sensitive — it just says "the operator set up the env var". Per-user connection state for a specific project is returned by `GET /api/connectors` (which DOES require auth + ownership verification).

### FEATURE 3 — Mobile App Scaffold (Expo)

**Files changed:** `mobile/package.json` (new), `mobile/app.json` (new), `mobile/index.ts` (new), `mobile/app/(tabs)/index.tsx` (new), `mobile/app/(tabs)/research.tsx` (new), `mobile/app/(tabs)/settings.tsx` (new), `mobile/app/(tabs)/_layout.tsx` (new), `mobile/lib/api-client.ts` (new), `mobile/docs/MOBILE.md` (new), `tsconfig.json` (mobile excluded), `eslint.config.mjs` (mobile ignored).

Scaffold only — Expo can't run in this environment (no Android SDK / Xcode). The files are ready for `cd mobile && npm install && npx expo start` once the developer has Expo set up locally.

- **`mobile/package.json`** — Expo SDK 51, React Native 0.74, React 18.2. Dependencies: `expo-router` (file-based routing), `expo-secure-store` (encrypted API-key storage), `expo-notifications` (research-completion push), `expo-local-authentication` (FaceID/TouchID), `@react-navigation/native` + `bottom-tabs`.
- **`mobile/app.json`** — Expo config. Name "Quaesitor", slug "quaesitor", scheme "quaesitor" (for deep linking `quaesitor://chat/{id}`). Splash background `#f4f1ea` (aged paper). iOS bundle `com.quaesitor.mobile` with `NSFaceIDUsageDescription`. Android package `com.quaesitor.mobile` with adaptive-icon background `#f4f1ea`. Plugins: expo-router, expo-secure-store, expo-notifications, expo-local-authentication.
- **`mobile/index.ts`** — entry point. `import "expo-router/entry"` (file-based routing).
- **`mobile/app/(tabs)/_layout.tsx`** — tab layout. 3 tabs: Chat (`MessageSquare` icon), Research (`Search` icon), Settings (`Settings` icon). All using the Quaesitor "Amber & Ink" palette: header bg `#f4f1ea`, active tint `#8b4513`, inactive tint `#6b6358`.
- **`mobile/app/(tabs)/index.tsx`** — Chat tab placeholder. "Quaesitor" title + "What shall we investigate?" subtitle.
- **`mobile/app/(tabs)/research.tsx`** — Research tab placeholder. Empty state "No research jobs yet".
- **`mobile/app/(tabs)/settings.tsx`** — Settings tab placeholder. 5 items: API Keys, Theme, Language, Memory, About.
- **`mobile/lib/api-client.ts`** — `QuaesitorAPI` class. Methods: `setApiKey`, `setBaseUrl`, `chat(message, conversationId)` (returns `ReadableStream<Uint8Array>` for SSE), `startResearch(query)` (returns `{ jobId }`), `getJobStatus(jobId)`. Default URL `http://localhost:3000`. Uses `Bearer ${apiKey}` auth (the API-key flow from p1-platform).
- **`mobile/docs/MOBILE.md`** — setup instructions, features list, configuration steps, build commands, design palette reference.
- **`tsconfig.json`** — `mobile` added to `exclude` array (alongside `node_modules`, `examples`, `skills`, `mini-services`). The mobile .ts/.tsx files use React Native APIs (`react-native`, `expo-router`, `lucide-react-native`) that aren't installed in the main project — excluding them keeps `tsc --noEmit` clean.
- **`eslint.config.mjs`** — `mobile/**` added to `ignores`. Same reason — the mobile files would fail eslint's React/TypeScript rules because the React Native types aren't resolvable.

## Test results

| Check                       | Before  | After  |
|-----------------------------|---------|--------|
| `bunx tsc --noEmit --strict`| 0       | **0**  |
| `bun run lint`              | 0 / 0   | **0 / 0** (0 errors, 0 warnings) |
| `bun run test`              | 451 / 1 skipped | **451 / 1 skipped** |

Two existing assertions were updated to reflect the new tool count:
- `src/lib/__tests__/agent-tools.test.ts`: `expect(tools.length).toBe(3)` → `.toBe(4)` + added `expect(tools).toContain("device_control")`.
- `src/lib/__tests__/react-agent.test.ts`: `expect(Object.keys(AGENT_TOOLS)).toHaveLength(3)` → `.toHaveLength(4)` + test name "has 3 tools registered" → "has 4 tools registered".

No new test files added (per the task rules — "do not write any test code"). The swarm test mock (`vi.mock("../agent-tools", ...)`) does NOT need updating because it mocks at the module level — the real `AGENT_TOOLS` registry is never imported by the swarm test, so adding `device_control` to the real registry doesn't affect the mocked one.

## Notes for downstream agents

- **Device control is a library, not an auto-executor.** The `executeDeviceAction()` function never runs unless an authenticated caller POSTs to `/api/device-control` or the swarm's `device_controller` role emits a `device_control` tool call. There is no background worker, no cron, no auto-discovery. The audit log is the source of truth for "what did the agent do to my device" — review `audit_logs` rows with `action = 'device_control.action'` to see every invocation.
- **The device_controller role is intentionally tool-restricted.** `ROLE_TOOLS.device_controller = ["device_control"]` — it can ONLY call the device_control tool, not web_search or run_code. This is defense in depth: a device_controller that could also web_search would be a much larger attack surface (the model could fetch a URL and pipe it into a shell command). If a future task needs a "device + research" hybrid, create a new role rather than expanding device_controller's tool list.
- **The `params` field on the device_control tool is declared as `string` (JSON-encoded), not `object`.** This matches the existing tool schema convention (see `run_code`'s `code` param). The tool's `execute()` accepts both string and object forms for flexibility — the LLM sometimes emits nested objects directly even when the schema says string. Don't "fix" this by removing the object branch.
- **The connectors framework is a STUB.** The `authUrl(state)` builders are real (they produce valid OAuth2 authorization URLs), but `handleCallback`, `search`, and `fetch` are unimplemented. Wiring them up requires: (1) a `/api/connectors/[type]/auth` route that generates + stores the `state` token and 302-redirects, (2) a `/api/connectors/[type]/callback` route that verifies `state` and exchanges the code for tokens, (3) per-service token-exchange implementations (Slack: `oauth.v2.access`, Notion: `oauth/token`, Drive: `oauth2.googleapis.com/token`, GitHub: `github.com/login/oauth/access_token`, Jira: `auth.atlassian.com/oauth/token`). The encrypted-credential storage already exists at `src/lib/credentials.ts` — use `encryptCredentials()` to store the access token + `decryptCredentials()` to read it back.
- **The mobile scaffold uses Expo SDK 51 + RN 0.74 + React 18.2.** These are pinned in `mobile/package.json`. When upgrading, also update `mobile/app.json`'s `plugins` array — Expo plugins are version-coupled to the SDK. The `mobile/` folder is excluded from `tsconfig.json` and ignored by `eslint.config.mjs` so the main project's type-check + lint don't try to resolve React Native types. Do NOT remove those excludes — the mobile .tsx files would fail both checks.
- **The audit-metadata whitelist in `/api/device-control/route.ts` is intentional.** `path`, `command`, `package`, `pid`, `url` are safe to log (they identify WHAT was touched, not the content). `content` (write_file), `text` (clipboard_write), and the action's `output` (read_file, list_files, etc.) are NOT logged because they can contain sensitive data. If you add a new device action with a new param, decide explicitly whether it's safe to audit-log before adding it to `auditMetadata()`.
- **The `device_control` tool's `parameters[1]` (params) is `required: false`.** This is correct — actions like `system_info`, `list_processes`, `network_status`, `disk_usage`, `env_vars`, `clipboard_read` take no params. Don't "fix" this by making it required.
