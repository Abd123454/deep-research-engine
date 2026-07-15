// Docker Code Sandbox — runs user code in isolated Docker containers.
//
// Security: --network=none, --read-only, --tmpfs, --user 1000:1000,
// memory limit 256m, CPU limit 0.5, 10s timeout.
//
// Falls back to vm-based sandbox (code-sandbox.ts) when Docker is not available.

import { exec } from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

const TIMEOUT_MS = 10_000;
const MEMORY_LIMIT = "256m";
const CPU_LIMIT = "0.5";
const MAX_OUTPUT = 10_000;

export interface DockerCodeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCodeDocker(
  language: "python" | "javascript" | "typescript",
  code: string
): Promise<DockerCodeResult> {
  const sessionId = crypto.randomUUID().slice(0, 8);
  const tempDir = path.join(os.tmpdir(), `sandbox-${sessionId}`);

  try {
    await fs.mkdir(tempDir, { recursive: true });

    let filename: string;
    let image: string;
    let cmd: string;

    if (language === "python") {
      filename = "main.py";
      image = "python:3.11-slim";
      cmd = "python main.py";
    } else if (language === "javascript") {
      filename = "main.js";
      image = "node:20-slim";
      cmd = "node main.js";
    } else {
      filename = "main.ts";
      image = "node:20-slim";
      cmd = "npx tsx main.ts";
    }

    await fs.writeFile(path.join(tempDir, filename), code);

    const { stdout, stderr } = await execAsync(
      `docker run --rm ` +
        `--memory=${MEMORY_LIMIT} ` +
        `--cpus=${CPU_LIMIT} ` +
        `--network=none ` +
        `--read-only ` +
        `--tmpfs /tmp:rw,size=64m ` +
        `--workdir /app ` +
        `--user 1000:1000 ` +
        `-v ${tempDir}:/app:ro ` +
        `--name sandbox-${sessionId} ` +
        `${image} ${cmd}`,
      { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }
    );

    return {
      stdout: stdout.slice(0, MAX_OUTPUT),
      stderr: stderr.slice(0, 5000),
      exitCode: 0,
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string; code?: number; killed?: boolean };
    return {
      stdout: "",
      stderr: (error.killed ? "Execution timed out (10s limit)." : error.stderr || error.message || "Execution failed").slice(0, 5000),
      exitCode: error.code || 1,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync("docker info", { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// Smart dispatcher: Docker first, vm fallback.
export async function runCodeSmart(
  language: string,
  code: string
): Promise<{ success: boolean; output: string; error?: string; executionTimeMs: number; provider: string }> {
  const start = Date.now();

  // Try Docker first if available.
  if (await isDockerAvailable()) {
    try {
      const langLower = language.toLowerCase();
      const langMap: Record<string, "python" | "javascript" | "typescript"> = {
        python: "python", py: "python",
        javascript: "javascript", js: "javascript",
        typescript: "typescript", ts: "typescript",
      };
      const normalizedLang = langMap[langLower];
      if (normalizedLang) {
        const result = await runCodeDocker(normalizedLang as "python" | "javascript" | "typescript", code);
        const output = result.stdout + (result.stderr ? "\n[stderr]\n" + result.stderr : "");
        return {
          success: result.exitCode === 0,
          output: output.slice(0, MAX_OUTPUT) || "(no output)",
          error: result.exitCode === 0 ? undefined : result.stderr.slice(0, 1000),
          executionTimeMs: Date.now() - start,
          provider: "docker",
        };
      }
    } catch {
      // Fall through to vm.
    }
  }

  // Fallback to vm-based sandbox.
  try {
    const { runCode } = await import("./code-sandbox");
    const result = await runCode(language, code);
    return { ...result, provider: "vm" };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
      executionTimeMs: Date.now() - start,
      provider: "none",
    };
  }
}
