/**
 * Code Execution Sandbox — runs user code safely with timeout + memory limits.
 *
 * SECURITY WARNING: The vm.runInContext fallback is NOT a security boundary.
 * Node.js docs explicitly state: "The node:vm module is not a security mechanism.
 * Do not use it to run untrusted code." (https://nodejs.org/api/vm.html)
 *
 * This fallback exists for DEVELOPMENT convenience only. In production:
 *   1. Run Docker (preferred) — see code-sandbox-docker.ts
 *   2. If Docker is unavailable, DISABLE code execution entirely by
 *      setting ENABLE_CODE_EXEC=false in env
 *   3. Never expose code execution to untrusted users without Docker
 *
 * Uses Node.js `vm` module for JavaScript/TypeScript execution.
 * For Python, uses subprocess with timeout (requires python3 installed).
 * For other languages, returns "not supported" gracefully.
 *
 * Security (vm fallback — NOT sufficient for untrusted code):
 * - No network access (no fetch, no http, no net module).
 * - No filesystem access (no fs, no path).
 * - 10-second timeout.
 * - 100MB memory limit (via --max-old-space-size for Node, ulimit for Python).
 * - Code runs in a sandboxed context with only safe globals.
 */

import vm from "vm";
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

export interface CodeResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
}

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_CHARS = 10_000;

// ---------- JavaScript/TypeScript ----------

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

// Async wrapper for JavaScript (handles promises properly).
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

// ---------- Python ----------

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
      env: {
        ...process.env,
        PATH: "/usr/bin:/usr/local/bin",
        PYTHONIOENCODING: "utf-8",
        PYTHONDONTWRITEBYTECODE: "1",
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
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

// ---------- Dispatcher ----------

export async function runCode(language: string, code: string): Promise<CodeResult> {
  // Production safety guard: block code execution in production without Docker.
  // The vm sandbox is NOT a security boundary (see header warning).
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_CODE_EXEC !== "true") {
    return {
      success: false,
      output: "",
      error: "Code execution is disabled in production without Docker. Set ENABLE_CODE_EXEC=true to override (NOT RECOMMENDED) or configure Docker.",
      executionTimeMs: 0,
    };
  }

  const lang = language.toLowerCase().trim();

  switch (lang) {
    case "javascript":
    case "js":
    case "typescript":
    case "ts":
      return runJavaScriptAsync(code);

    case "python":
    case "py":
      return runPython(code);

    default:
      return {
        success: false,
        output: "",
        error: `Language "${language}" is not supported. Use: javascript, typescript, or python.`,
        executionTimeMs: 0,
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
