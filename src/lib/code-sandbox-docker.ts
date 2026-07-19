// Docker Code Sandbox — runs user code in isolated Docker containers.
//
// Security: --network=none, --read-only, --tmpfs, --user 1000:1000,
// memory limit 256m, CPU limit 0.5, 10s timeout.
//
// V2 audit fix: the vm fallback has been removed entirely. Docker is
// the ONLY execution backend for untrusted code. Callers that need
// the legacy vm helpers should migrate to `runCodeDocker` directly —
// there is no longer a `runCode`-via-vm path to fall back to.
//
// P0-8 (hardening audit): container naming + extra security flags:
//   - `--name` now includes a random 8-hex suffix so two concurrent
//     sandboxes cannot collide on the same `sandbox-${sessionId}` name
//     (which previously caused `docker run` to fail with "name already
//     in use" if a stale container hadn't been reaped yet).
//   - `--init` runs an init process inside the container so zombie
//     children are reaped (without it, a child that orphaned its
//     parent would linger as PID 1 with no reaper).
//   - `--memory-swap=${MEMORY_LIMIT}` disables swap (set to the same
//     value as `--memory`, so the kernel cannot page the container's
//     anonymous memory to disk — protects the host's swap partition
//     from a memory-hoarding sandbox).
//   - `--ulimit nofile=64:64` + `--ulimit nproc=64:64` cap the
//     number of open file descriptors and processes per user inside
//     the container, hardening against fd-exhaustion and fork bombs
//     (defense-in-depth on top of `--pids-limit`).
//   - `docker rm -f <name>` is run BEFORE `docker run` to clean up
//     any stale container left behind by a previous crashed run.
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

    // P0-8 (hardening audit): container name includes a random 8-hex
    // suffix so two concurrent sandboxes cannot collide. Previously
    // `--name sandbox-${sessionId}` would fail with "name already in
    // use" if a stale container hadn't been reaped by `--rm` (e.g. the
    // host OOM-killed docker between the container exit and the
    // reaper running). The random suffix makes collisions effectively
    // impossible.
    const containerName = `quaesitor-sandbox-${sessionId}-${crypto.randomBytes(4).toString("hex")}`;

    // P0-8: defensively clean up any stale container with the same
    // name before starting a new one. With the random suffix this
    // should never collide, but `docker rm -f` is idempotent and
    // cheap — and if we ever revert to a deterministic name (e.g.
    // for testability), this guard is what prevents the collision
    // from breaking the sandbox.
    try {
      await execAsync(`docker rm -f ${containerName} 2>/dev/null`, {
        timeout: 5_000,
      });
    // eslint-disable-next-line no-empty
    } catch {
      // Ignore — container doesn't exist (the common case) or docker
      // is unreachable (the subsequent `docker run` will surface a
      // better error).
    }

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
    //
    // P0-8 additions:
    // --init                            → run tini as PID 1 inside the
    //   container, so orphaned/zombie child processes are reaped
    //   (default PID 1 in a container doesn't reap zombies — they
    //   accumulate until the container exits).
    // --memory-swap=256m                → set swap limit equal to the
    //   memory limit, effectively disabling swap for the container.
    //   Without this, the kernel can page the container's anonymous
    //   memory to the host's swap — a memory-hogging sandbox would
    //   exhaust the host's swap partition instead of being OOM-killed.
    // --ulimit nofile=64:64             → cap open file descriptors
    //   per process at 64 (default is typically 1048576 on Linux —
    //   a sandbox that opens thousands of fds could exhaust the
    //   host's file table or exhaust its own PID limit indirectly).
    // --ulimit nproc=64:64              → cap processes per user at 64
    //   (defense-in-depth on top of `--pids-limit=64` — the latter
    //   is per-container, this is per-UID inside the container).
    const { stdout, stderr } = await execAsync(
      `docker run --rm ` +
        `--security-opt=no-new-privileges ` +
        `--cap-drop=ALL ` +
        `--pids-limit=64 ` +
        `--memory=${MEMORY_LIMIT} ` +
        `--memory-swap=${MEMORY_LIMIT} ` +
        `--cpus=${CPU_LIMIT} ` +
        `--ulimit nofile=64:64 ` +
        `--ulimit nproc=64:64 ` +
        `--init ` +
        `--network=none ` +
        `--read-only ` +
        `--tmpfs /tmp:rw,nosuid,nodev,size=64m ` +
        `--workdir /app ` +
        `--user 1000:1000 ` +
        `-v ${tempDir}:/app:ro ` +
        `--name ${containerName} ` +
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

// Smart dispatcher — V2 audit fix: Docker is the ONLY execution
// backend. Mirrors the policy in code-sandbox.ts:
//   - If `ENABLE_CODE_EXEC != "true"` → disabled error.
//   - If Docker is available → run via `runCodeDocker`.
//   - If Docker is NOT available → hard Docker-required error.
//   (There is no longer a vm fallback path.)
export async function runCodeSmart(
  language: string,
  code: string
): Promise<{ success: boolean; output: string; error?: string; executionTimeMs: number; provider: string }> {
  const start = Date.now();

  // Import here so this module can be loaded in environments where
  // `code-sandbox.ts` would otherwise create a circular import.
  const { CODE_EXEC_ENABLED } = await import("./code-sandbox");

  // Disabled?
  if (!CODE_EXEC_ENABLED) {
    return {
      success: false,
      output: "",
      error: "Code execution is disabled. Set ENABLE_CODE_EXEC=true to enable (requires a proper sandbox — see SECURITY.md).",
      executionTimeMs: Date.now() - start,
      provider: "none",
    };
  }

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
      // Fall through to the Docker-required error below.
    }
  }

  // V2 audit fix: Docker is required. No vm fallback.
  return {
    success: false,
    output: "",
    error: "Docker is required for code execution. Set ENABLE_CODE_EXEC=true and install Docker.",
    executionTimeMs: Date.now() - start,
    provider: "none",
  };
}

