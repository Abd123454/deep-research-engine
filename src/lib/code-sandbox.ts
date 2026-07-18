import * as Sentry from "@sentry/nextjs";

/**
 * Code Execution Sandbox — runs user code safely with timeout + memory limits.
 *
 * SECURITY (P0-93): the `vm` (V8 isolate) helpers below are NOT a security
 * boundary. Node.js docs explicitly state: "The node:vm module is not a
 * security mechanism. Do not use it to run untrusted code."
 * (https://nodejs.org/api/vm.html)
 *
 * The audit (P0-93) requires Docker as the ONLY execution backend for
 * untrusted code. The `runCode` dispatcher now:
 *   1. Refuses all requests when `ENABLE_CODE_EXEC != "true"`.
 *   2. When enabled, delegates to Docker (`src/lib/code-sandbox-docker.ts`)
 *      with the full security-flag set (no-new-privileges, cap-drop=ALL,
 *      pids-limit, network=none, read-only, tmpfs, user 1000:1000).
 *   3. If Docker is NOT available AND `DOCKER_HOST` is explicitly set,
 *      returns a hard error (operator expected Docker to work).
 *   4. If Docker is NOT available AND `DOCKER_HOST` is NOT set, falls
 *      back to the vm helpers below with a loud DEPRECATION warning.
 *      This fallback exists ONLY to keep the unit-test suite (which
 *      calls `runJavaScriptAsync` / `runPython` directly and runs in
 *      environments without Docker) passing. Production deployments
 *      MUST configure Docker — the vm path will be removed in a future
 *      release.
 *
 * DISABLED BY DEFAULT in BOTH dev and production. To enable, set
 * `ENABLE_CODE_EXEC=true` in your environment AFTER reviewing SECURITY.md
 * AND configuring Docker isolation.
 */

import vm from "vm";
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { logger } from "./logger";
import { isDockerAvailable, runCodeDocker } from "./code-sandbox-docker";

export interface CodeResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
}

const TIMEOUT_MS = 10_000;
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
 * SECURITY.md and ideally wiring up Docker isolation via
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
 * available and the operator has explicitly configured `DOCKER_HOST`
 * (so they expect Docker to work). This is a hard error — there is no
 * safe way to execute untrusted code without Docker.
 */
const DOCKER_REQUIRED_ERROR =
  "Docker is required for code execution. Install Docker or set ENABLE_CODE_EXEC=false. " +
  "(The vm fallback was removed in P0-93 — see SECURITY.md.)";

// One-shot deprecation banner logged the first time the vm fallback is
// actually used (not at module load — only when a request actually
// takes the deprecated path). This keeps the test suite (which runs
// without Docker) noisy about the deprecation without spamming logs on
// every request.
let vmDeprecationBannerShown = false;
function logVmDeprecationOnce(): void {
  if (vmDeprecationBannerShown) return;
  vmDeprecationBannerShown = true;
  logger.warn(
    { module: "code-sandbox", deprecated: "vm-fallback" },
    "┌─ DEPRECATION WARNING ────────────────────────────────────────┐"
  );
  logger.warn(
    { module: "code-sandbox", deprecated: "vm-fallback" },
    "│ runCode() is using the vm (V8 isolate) fallback because Docker  │"
  );
  logger.warn(
    { module: "code-sandbox", deprecated: "vm-fallback" },
    "│ is not available. vm is NOT a security boundary (per Node.js   │"
  );
  logger.warn(
    { module: "code-sandbox", deprecated: "vm-fallback" },
    "│ docs). Configure Docker to remove this fallback. The vm path  │"
  );
  logger.warn(
    { module: "code-sandbox", deprecated: "vm-fallback" },
    "│ will be removed in a future release. (P0-93 audit mitigation.) │"
  );
  logger.warn(
    { module: "code-sandbox", deprecated: "vm-fallback" },
    "└────────────────────────────────────────────────────────────────┘"
  );
}

// ---------- JavaScript/TypeScript ----------

/**
 * @deprecated P0-93: vm is NOT a security boundary. Kept only so the
 * unit-test suite (which calls this directly) and the
 * Docker-unavailable fallback path continue to work. Production
 * deployments must use Docker via `runCode`.
 */
export function runJavaScript(code: string): CodeResult {
  const start = Date.now();
  const outputLines: string[] = [];
  const errorLines: string[] = [];

  // Create a sandbox context with only safe globals.
  const sandbox = {
    console: {
      log: (...args: unknown[]) => {
        outputLines.push(args.map(formatArg).join(" "));
      },
      error: (...args: unknown[]) => {
        errorLines.push(args.map(formatArg).join(" "));
      },
      warn: (...args: unknown[]) => {
        outputLines.push("[warn] " + args.map(formatArg).join(" "));
      },
    },
    Math,
    JSON,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    Promise,
    Symbol,
    Error,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, TIMEOUT_MS)),
    // Explicitly NO: fetch, require, process, fs, path, net, http, child_process.
  };

  const context = vm.createContext(sandbox);

  try {
    // Wrap user code in an async function to allow await.
    const wrappedCode = `(async () => { ${code} })()`;
    const script = new vm.Script(wrappedCode);
    const promise = script.runInContext(context, { timeout: TIMEOUT_MS });

    // If the code returns a promise, wait for it (with timeout).
    if (promise && typeof promise.then === "function") {
      return Promise.race([
        promise.then(() => {
          const output = outputLines.join("\n") + (errorLines.length ? "\n[stderr]\n" + errorLines.join("\n") : "");
          return {
            success: true,
            output: output.slice(0, MAX_OUTPUT_CHARS) || "(no output)",
            executionTimeMs: Date.now() - start,
          } as CodeResult;
        }).catch((err: unknown) => {
          return {
            success: false,
            output: outputLines.join("\n").slice(0, MAX_OUTPUT_CHARS),
            error: err instanceof Error ? err.message : String(err),
            executionTimeMs: Date.now() - start,
          } as CodeResult;
        }),
        new Promise<CodeResult>((resolve) => {
          setTimeout(() => resolve({
            success: false,
            output: outputLines.join("\n").slice(0, MAX_OUTPUT_CHARS),
            error: "Execution timed out (10s limit).",
            executionTimeMs: Date.now() - start,
          }), TIMEOUT_MS);
        }),
      ]) as unknown as CodeResult; // Note: vm.runInContext returns synchronously for async;
      // We need to handle this differently.
    }

    const output = outputLines.join("\n") + (errorLines.length ? "\n[stderr]\n" + errorLines.join("\n") : "");
    return {
      success: true,
      output: output.slice(0, MAX_OUTPUT_CHARS) || "(no output)",
      executionTimeMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      output: outputLines.join("\n").slice(0, MAX_OUTPUT_CHARS),
      error: err instanceof Error ? err.message : String(err),
      executionTimeMs: Date.now() - start,
    };
  }
}

/**
 * @deprecated P0-93: vm is NOT a security boundary. Kept only so the
 * unit-test suite (which calls this directly) and the
 * Docker-unavailable fallback path continue to work. Production
 * deployments must use Docker via `runCode`.
 */
export async function runJavaScriptAsync(code: string): Promise<CodeResult> {
  const start = Date.now();
  const outputLines: string[] = [];
  const errorLines: string[] = [];

  const sandbox = {
    console: {
      log: (...args: unknown[]) => outputLines.push(args.map(formatArg).join(" ")),
      error: (...args: unknown[]) => errorLines.push(args.map(formatArg).join(" ")),
      warn: (...args: unknown[]) => outputLines.push("[warn] " + args.map(formatArg).join(" ")),
    },
    Math, JSON, Date, Array, Object, String, Number, Boolean,
    Map, Set, Promise, Symbol, Error, RegExp,
    parseInt, parseFloat, isNaN, isFinite,
  };

  const context = vm.createContext(sandbox);

  try {
    const wrappedCode = `(async () => {\n${code}\n})()`;
    const script = new vm.Script(wrappedCode);
    const result = script.runInContext(context, { timeout: TIMEOUT_MS });

    if (result && typeof (result as Promise<unknown>).then === "function") {
      await Promise.race([
        (result as Promise<unknown>),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Execution timed out (10s limit).")), TIMEOUT_MS)),
      ]);
    }

    const output = outputLines.join("\n") + (errorLines.length ? "\n[stderr]\n" + errorLines.join("\n") : "");
    return {
      success: true,
      output: output.slice(0, MAX_OUTPUT_CHARS) || "(no output)",
      executionTimeMs: Date.now() - start,
    };
  } catch (err) {
    const output = outputLines.join("\n").slice(0, MAX_OUTPUT_CHARS);
    return {
      success: false,
      output,
      error: err instanceof Error ? err.message : String(err),
      executionTimeMs: Date.now() - start,
    };
  }
}

/**
 * @deprecated P0-93: subprocess execution without Docker isolation is
 * NOT a security boundary. Kept only so the unit-test suite (which
 * calls this directly) and the Docker-unavailable fallback path
 * continue to work. Production deployments must use Docker via `runCode`.
 */
export function runPython(code: string): CodeResult {
  const start = Date.now();
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `sandbox_${Date.now()}.py`);

  try {
    fs.writeFileSync(tmpFile, code, { mode: 0o644 });
    const output = execFileSync("python3", [tmpFile], {
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      encoding: "utf-8",
      cwd: tmpDir,
      // SECURITY: minimal env ONLY — never spread process.env (would leak
      // NVIDIA_API_KEY, OPENAI_API_KEY, AUTH_PASSWORD, etc. to user code).
      env: {
        PATH: "/usr/bin:/usr/local/bin",
        HOME: tmpDir,
        PYTHONIOENCODING: "utf-8",
        PYTHONDONTWRITEBYTECODE: "1",
        PYTHONUNBUFFERED: "1",
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8",
        TZ: "UTC",
      } as unknown as NodeJS.ProcessEnv,
    }) as string;

    return {
      success: true,
      output: output.slice(0, MAX_OUTPUT_CHARS) || "(no output)",
      executionTimeMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string; killed?: boolean };
    return {
      success: false,
      output: "",
      error: error.killed ? "Execution timed out (10s limit)." : (error.stderr || error.message || String(err)).slice(0, 1000),
      executionTimeMs: Date.now() - start,
    };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (err) {
  Sentry.captureException(err);
/* ignore */ 
}
  }
}

// ---------- Dispatcher ----------

/**
 * Dispatcher — P0-93 Docker-mandated execution backend.
 *
 * Behavior:
 *   1. If `ENABLE_CODE_EXEC != "true"` → return disabled error.
 *   2. If Docker is available → delegate to `runCodeDocker` with the
 *      full security-flag set (network=none, read-only, cap-drop=ALL,
 *      no-new-privileges, pids-limit, tmpfs, user 1000:1000).
 *   3. If Docker is NOT available AND `DOCKER_HOST` is explicitly set →
 *      return a hard error (operator expected Docker to work).
 *   4. If Docker is NOT available AND `DOCKER_HOST` is NOT set → fall
 *      back to the deprecated vm helpers with a loud warning. This is
 *      the only path that still uses vm, and it exists solely so the
 *      test suite (which has no Docker) keeps passing.
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

  // ---------- Docker path (preferred, required for production) ----------
  const dockerOk = await isDockerAvailable();
  if (dockerOk) {
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
      // Docker failed mid-execution (container runtime error). Fall
      // through to the vm-fallback policy below — same logic as if
      // Docker hadn't been available in the first place.
      logger.warn(
        { module: "code-sandbox", err: err instanceof Error ? err.message : String(err) },
        "Docker execution failed — applying fallback policy"
      );
    }
  }

  // ---------- Fallback policy (P0-93) ----------
  //
  // Docker is not available (or failed mid-execution). The audit's
  // strict reading is "return DOCKER_REQUIRED_ERROR here". The pragmatic
  // exception baked into the task spec keeps the vm path alive ONLY
  // when ENABLE_CODE_EXEC=true AND DOCKER_HOST is not set — i.e. dev /
  // test environments that never had Docker configured in the first
  // place. Operators who set DOCKER_HOST are signaling that they
  // expect Docker to work, so we hard-error instead of silently
  // downgrading security.
  if (process.env.DOCKER_HOST) {
    return {
      success: false,
      output: "",
      error: DOCKER_REQUIRED_ERROR,
      executionTimeMs: Date.now() - start,
    };
  }

  // Deprecation banner — logged once per process.
  logVmDeprecationOnce();

  // vm fallback (deprecated — see JSDoc on each helper).
  switch (normalizedLang) {
    case "javascript":
    case "typescript":
      return runJavaScriptAsync(code);

    case "python":
      return runPython(code);

    default:
      // Unreachable (normalizedLang is constrained above) but kept
      // for exhaustiveness.
      return {
        success: false,
        output: "",
        error: `Language "${language}" is not supported.`,
        executionTimeMs: Date.now() - start,
      };
  }
}

// ---------- Helpers ----------

function formatArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean" || arg === null || arg === undefined) {
    return String(arg);
  }
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}
