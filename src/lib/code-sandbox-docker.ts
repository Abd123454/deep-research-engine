// Docker Code Sandbox — runs user code in isolated Docker containers.
//
// Security: --network=none, --read-only, --tmpfs, --user 1000:1000,
// memory limit 256m, CPU limit 0.5, 10s timeout.
//
// Falls back to vm-based sandbox (code-sandbox.ts) when Docker is not available.
import * as Sentry from "@sentry/nextjs";


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

    // P0-93: full Docker security flag set. Each flag is a separate
    // layer of defense — removing any one weakens the sandbox.
    //
    // --security-opt=no-new-privileges  → child processes cannot gain
    //   elevated capabilities via setuid binaries (e.g. sudo, ping).
    // --cap-drop=ALL                    → drop ALL Linux capabilities
    //   (CAP_NET_RAW, CAP_SYS_ADMIN, …) — the container cannot do
    //   anything that requires a capability, including mounting
    //   filesystems or opening privileged sockets.
    // --pids-limit=64                   → cap the number of processes /
    //   threads in the container at 64 — prevents fork bombs from
    //   exhausting the host's PID table.
    // --network=none                    → no network access at all
    //   (no outbound HTTP, no DNS, no port scanning).
    // --read-only                       → root filesystem is mounted
    //   read-only; the container cannot persist anything to disk
    //   outside the tmpfs.
    // --tmpfs /tmp:rw,nosuid,nodev,size=64m
    //   → /tmp is writable (programs need it) but is in-memory,
    //   nosuid (no setuid binaries), nodev (no device files),
    //   size-capped at 64MB.
    // --user 1000:1000                  → run as non-root UID 1000
    //   (matches the host's typical first user account — the container
    //   never runs as root, even if it tries to).
    // --memory=256m --cpus=0.5          → resource caps so a runaway
    //   process cannot starve the host.
    const { stdout, stderr } = await execAsync(
      `docker run --rm ` +
        `--security-opt=no-new-privileges ` +
        `--cap-drop=ALL ` +
        `--pids-limit=64 ` +
        `--memory=${MEMORY_LIMIT} ` +
        `--cpus=${CPU_LIMIT} ` +
        `--network=none ` +
        `--read-only ` +
        `--tmpfs /tmp:rw,nosuid,nodev,size=64m ` +
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

// Smart dispatcher — mirrors the policy in code-sandbox.ts:
//   - Docker first (with the full P0-93 security flag set).
//   - If Docker is NOT available AND `DOCKER_HOST` is set → hard error.
//   - If Docker is NOT available AND `DOCKER_HOST` is NOT set → fall
//     back to `runCode` (which itself may take the deprecated vm path
//     with a one-shot deprecation banner). The `provider` field on the
//     returned object reflects which backend actually ran the code.
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
    } catch (err) {
      Sentry.captureException(err);
      // Fall through to the fallback policy below.
    }
  }

  // P0-93 fallback policy: hard-error if DOCKER_HOST is set (operator
  // expected Docker to work), otherwise delegate to runCode which will
  // apply the same DOCKER_HOST check + deprecation warning before
  // touching the vm helpers.
  if (process.env.DOCKER_HOST) {
    return {
      success: false,
      output: "",
      error: "Docker is required for code execution. Install Docker or set ENABLE_CODE_EXEC=false. (The vm fallback was removed in P0-93 — see SECURITY.md.)",
      executionTimeMs: Date.now() - start,
      provider: "none",
    };
  }

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
