/**
 * Code Execution Sandbox — runs user code safely with timeout + memory limits.
 *
 * SECURITY (V2 audit fix — vm fallback REMOVED): the `vm` (V8 isolate)
 * module is NOT a security boundary. Node.js docs explicitly state:
 * "The node:vm module is not a security mechanism. Do not use it to run
 * untrusted code." (https://nodejs.org/api/vm.html)
 *
 * The audit (V2) requires Docker as the ONLY execution backend for
 * untrusted code. The `runCode` dispatcher now:
 *   1. Refuses all requests when `ENABLE_CODE_EXEC != "true"`.
 *   2. When enabled AND Docker is available → delegates to
 *      `runCodeDocker` (src/lib/code-sandbox-docker.ts) with the full
 *      security-flag set (no-new-privileges, cap-drop=ALL, pids-limit,
 *      network=none, read-only, tmpfs, user 1000:1000).
 *   3. When enabled AND Docker is NOT available → returns a hard error.
 *      There is NO fallback. Operators who want code execution MUST
 *      install Docker.
 *
 * The previously-existing `runJavaScript`, `runJavaScriptAsync`, and
 * `runPython` helpers (which used `vm.runInContext` / `execFileSync`
 * without sandboxing) have been removed entirely.
 *
 * DISABLED BY DEFAULT in BOTH dev and production. To enable, set
 * `ENABLE_CODE_EXEC=true` in your environment AFTER reviewing SECURITY.md
 * AND configuring Docker isolation.
 */

import { logger } from "./logger";
import { isDockerAvailable, runCodeDocker } from "./code-sandbox-docker";

export interface CodeResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
}

const MAX_OUTPUT_CHARS = 10_000;

/**
 * CODE_EXEC_ENABLED — explicit opt-in for code execution.
 *
 * Code execution is **disabled by default** in BOTH development and
 * production. The `vm` module fallback is NOT a security boundary
 * (see the file header warning), so we require operators to set
 * `ENABLE_CODE_EXEC=true` in their environment before any user code
 * is run — regardless of NODE_ENV.
 *
 * To enable: set `ENABLE_CODE_EXEC=true` in `.env` (after reviewing
 * SECURITY.md and wiring up Docker isolation via
 * `src/lib/code-sandbox-docker.ts`).
 */
export const CODE_EXEC_ENABLED = process.env.ENABLE_CODE_EXEC === "true";

// One-shot startup warning banner so operators see the disabled state
// in server logs (mirrors the "warning banner" pattern requested by
// the security audit).
if (!CODE_EXEC_ENABLED) {
  logger.warn(
    { module: "code-sandbox" },
    "┌─ CODE EXECUTION DISABLED ─────────────────────────────────────┐"
  );
  logger.warn(
    { module: "code-sandbox" },
    "│ runCode() will refuse all requests. To enable, set             │"
  );
  logger.warn(
    { module: "code-sandbox" },
    "│ ENABLE_CODE_EXEC=true in your environment AFTER reviewing      │"
  );
  logger.warn(
    { module: "code-sandbox" },
    "│ SECURITY.md and configuring Docker isolation.                  │"
  );
  logger.warn(
    { module: "code-sandbox" },
    "└────────────────────────────────────────────────────────────────┘"
  );
}

const CODE_EXEC_DISABLED_ERROR =
  "Code execution is disabled. Set ENABLE_CODE_EXEC=true to enable (requires a proper sandbox — see SECURITY.md).";

/**
 * Error returned when `ENABLE_CODE_EXEC=true` is set but Docker is not
 * available. V2 audit fix: there is no longer a vm fallback — Docker
 * is the only execution backend.
 */
const DOCKER_REQUIRED_ERROR =
  "Docker is required for code execution. Set ENABLE_CODE_EXEC=true and install Docker.";

// ---------- Dispatcher ----------

/**
 * Dispatcher — V2 audit fix: Docker is the ONLY execution backend.
 *
 * Behavior:
 *   1. If `ENABLE_CODE_EXEC != "true"` → return disabled error.
 *   2. If Docker is available → delegate to `runCodeDocker` with the
 *      full security-flag set (network=none, read-only, cap-drop=ALL,
 *      no-new-privileges, pids-limit, tmpfs, user 1000:1000).
 *   3. If Docker is NOT available → return a hard Docker-required
 *      error. There is NO vm fallback.
 */
export async function runCode(language: string, code: string): Promise<CodeResult> {
  if (!CODE_EXEC_ENABLED) {
    return {
      success: false,
      output: "",
      error: CODE_EXEC_DISABLED_ERROR,
      executionTimeMs: 0,
    };
  }

  const lang = language.toLowerCase().trim();
  const langMap: Record<string, "python" | "javascript" | "typescript"> = {
    python: "python", py: "python",
    javascript: "javascript", js: "javascript",
    typescript: "typescript", ts: "typescript",
  };
  const normalizedLang = langMap[lang];
  if (!normalizedLang) {
    return {
      success: false,
      output: "",
      error: `Language "${language}" is not supported. Use: javascript, typescript, or python.`,
      executionTimeMs: 0,
    };
  }

  const start = Date.now();

  const dockerOk = await isDockerAvailable();
  if (!dockerOk) {
    // V2 audit fix: no vm fallback. Docker is required.
    return {
      success: false,
      output: "",
      error: DOCKER_REQUIRED_ERROR,
      executionTimeMs: Date.now() - start,
    };
  }

  try {
    const result = await runCodeDocker(normalizedLang, code);
    const output = result.stdout + (result.stderr ? "\n[stderr]\n" + result.stderr : "");
    return {
      success: result.exitCode === 0,
      output: output.slice(0, MAX_OUTPUT_CHARS) || "(no output)",
      error: result.exitCode === 0 ? undefined : result.stderr.slice(0, 1000) || "Execution failed",
      executionTimeMs: Date.now() - start,
    };
  } catch (err) {
    // Docker failed mid-execution (container runtime error). No
    // fallback — surface the error to the caller.
    logger.warn(
      { module: "code-sandbox", err: err instanceof Error ? err.message : String(err) },
      "Docker execution failed"
    );
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
      executionTimeMs: Date.now() - start,
    };
  }
}
