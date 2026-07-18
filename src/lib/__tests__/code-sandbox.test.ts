// Tests for code-sandbox.ts — Docker-only execution policy.
//
// V2 audit fix: the `vm` (V8 isolate) helpers (`runJavaScript`,
// `runJavaScriptAsync`, `runPython`) have been removed entirely. Docker
// is the ONLY execution backend. These tests verify the dispatcher's
// new behavior:
//   - When `ENABLE_CODE_EXEC != "true"` → disabled error.
//   - When enabled but Docker is NOT available → Docker-required error.
//   - When enabled AND Docker is available → delegates to runCodeDocker
//     (mocked here so the tests don't actually need a Docker daemon).
//   - Unsupported language → error.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Docker backend so the dispatcher can be tested without a
// real Docker daemon. The mocked `isDockerAvailable` defaults to
// `false` (so the disabled/Docker-required paths are exercised); tests
// that need the Docker path flip it to `true`.
const mockIsDockerAvailable = vi.fn(async () => false);
const mockRunCodeDocker = vi.fn(async () => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
}));

vi.mock("../code-sandbox-docker", () => ({
  isDockerAvailable: mockIsDockerAvailable,
  runCodeDocker: mockRunCodeDocker,
}));

// Mock the logger so the disabled-state banner doesn't pollute test output.
vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// `runCode` is intentionally NOT imported at the top level — each
// test uses `vi.resetModules()` + a fresh `await import("../code-sandbox")`
// because `CODE_EXEC_ENABLED` is captured at module load (so toggling
// `process.env.ENABLE_CODE_EXEC` requires a re-import to take effect).

beforeEach(() => {
  vi.clearAllMocks();
  // Default: Docker not available.
  mockIsDockerAvailable.mockResolvedValue(false);
  // Default: code execution disabled (matches the unset env in CI).
  delete process.env.ENABLE_CODE_EXEC;
});

describe("runCode dispatcher (V2 — Docker-only)", () => {
  it("returns the disabled error when ENABLE_CODE_EXEC is not 'true'", async () => {
    delete process.env.ENABLE_CODE_EXEC;
    // Re-import to pick up the env change. The `CODE_EXEC_ENABLED`
    // constant is captured at module load.
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    const result = await freshRunCode("javascript", "console.log('hi');");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Code execution is disabled/i);
    expect(result.error).toMatch(/ENABLE_CODE_EXEC=true/);
    // The Docker backend must NOT have been called.
    expect(mockRunCodeDocker).not.toHaveBeenCalled();
  });

  it("returns the Docker-required error when enabled but Docker is unavailable", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(false);

    const result = await freshRunCode("javascript", "console.log('hi');");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Docker is required for code execution/i);
    expect(result.error).toMatch(/ENABLE_CODE_EXEC=true/);
    expect(result.error).toMatch(/install Docker/i);
    // The Docker backend must NOT have been called (Docker wasn't available).
    expect(mockRunCodeDocker).not.toHaveBeenCalled();
  });

  it("returns the Docker-required error for python when Docker is unavailable", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(false);

    const result = await freshRunCode("python", "print('hi')");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Docker is required for code execution/i);
  });

  it("returns error for unsupported language even when Docker is enabled", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);

    const result = await freshRunCode("ruby", "puts 'hello'");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not supported/i);
    // We short-circuit on the unsupported language BEFORE calling Docker.
    expect(mockRunCodeDocker).not.toHaveBeenCalled();
  });

  it("delegates to runCodeDocker when enabled and Docker is available", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({
      stdout: "hello world\n",
      stderr: "",
      exitCode: 0,
    });

    const result = await freshRunCode("javascript", "console.log('hello world');");
    expect(result.success).toBe(true);
    expect(result.output).toContain("hello world");
    expect(mockRunCodeDocker).toHaveBeenCalledTimes(1);
    expect(mockRunCodeDocker).toHaveBeenCalledWith("javascript", "console.log('hello world');");
  });

  it("routes python to runCodeDocker when Docker is available", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({
      stdout: "hello python\n",
      stderr: "",
      exitCode: 0,
    });

    const result = await freshRunCode("python", "print('hello python')");
    expect(result.success).toBe(true);
    expect(result.output).toContain("hello python");
    expect(mockRunCodeDocker).toHaveBeenCalledWith("python", "print('hello python')");
  });

  it("normalizes language aliases (js → javascript, ts → typescript, py → python)", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await freshRunCode("js", "console.log(1);");
    expect(mockRunCodeDocker).toHaveBeenLastCalledWith("javascript", "console.log(1);");

    await freshRunCode("ts", "console.log(1);");
    expect(mockRunCodeDocker).toHaveBeenLastCalledWith("typescript", "console.log(1);");

    await freshRunCode("py", "print(1)");
    expect(mockRunCodeDocker).toHaveBeenLastCalledWith("python", "print(1)");
  });

  it("surfaces Docker execution failures as a failed CodeResult (no fallback)", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockRejectedValue(new Error("container runtime exploded"));

    const result = await freshRunCode("javascript", "console.log('hi');");
    expect(result.success).toBe(false);
    expect(result.error).toContain("container runtime exploded");
  });

  it("does NOT execute code through any vm-based path (removed in V2)", async () => {
    // The vm helpers were removed entirely. We assert that the
    // dispatcher never silently falls back to anything other than
    // Docker — when Docker is unavailable, the error explicitly says
    // "Docker is required".
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(false);

    const result = await freshRunCode("javascript", "console.log('hi');");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Docker is required/i);
    // No vm code path should have produced output.
    expect(result.output).toBe("");
  });

  it("treats ENABLE_CODE_EXEC=false the same as unset (disabled)", async () => {
    process.env.ENABLE_CODE_EXEC = "false";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);

    const result = await freshRunCode("javascript", "console.log('hi');");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Code execution is disabled/i);
    expect(mockRunCodeDocker).not.toHaveBeenCalled();
  });

  it("treats ENABLE_CODE_EXEC=1 (not 'true') as disabled (strict equality)", async () => {
    process.env.ENABLE_CODE_EXEC = "1";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);

    const result = await freshRunCode("javascript", "console.log('hi');");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Code execution is disabled/i);
  });

  it("routes TypeScript to runCodeDocker when Docker is available", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({
      stdout: "ts output\n",
      stderr: "",
      exitCode: 0,
    });

    const result = await freshRunCode("typescript", "const x: number = 1; console.log(x);");
    expect(result.success).toBe(true);
    expect(result.output).toContain("ts output");
    expect(mockRunCodeDocker).toHaveBeenCalledWith(
      "typescript",
      "const x: number = 1; console.log(x);"
    );
  });

  it("surfaces non-zero Docker exit codes as a failed CodeResult with stderr", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({
      stdout: "",
      stderr: "ReferenceError: x is not defined\n    at main.js:1:1\n",
      exitCode: 1,
    });

    const result = await freshRunCode("javascript", "console.log(x);");
    expect(result.success).toBe(false);
    expect(result.error).toContain("ReferenceError");
    expect(result.error).toContain("x is not defined");
  });

  it("includes stderr in the output when Docker execution produces stderr", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({
      stdout: "stdout line\n",
      stderr: "stderr line\n",
      exitCode: 0,
    });

    const result = await freshRunCode("python", "print('stdout line')");
    expect(result.success).toBe(true);
    expect(result.output).toContain("stdout line");
    expect(result.output).toContain("[stderr]");
    expect(result.output).toContain("stderr line");
  });

  it("truncates Docker output to the MAX_OUTPUT_CHARS limit", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    const longOutput = "x".repeat(50_000);
    mockRunCodeDocker.mockResolvedValue({
      stdout: longOutput,
      stderr: "",
      exitCode: 0,
    });

    const result = await freshRunCode("javascript", "console.log('long');");
    expect(result.success).toBe(true);
    // MAX_OUTPUT_CHARS = 10_000 in code-sandbox.ts.
    expect(result.output.length).toBeLessThanOrEqual(10_000);
  });

  it("does NOT short-circuit on empty code — passes it through to Docker", async () => {
    // The dispatcher doesn't have a "no code" check — that's the
    // caller's responsibility (e.g. the run_code tool wrapper checks
    // for empty code before calling runCode). When Docker is available
    // and code execution is enabled, runCode delegates to Docker
    // regardless of the code's content.
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    const result = await freshRunCode("javascript", "");
    expect(result.success).toBe(true);
    expect(mockRunCodeDocker).toHaveBeenCalledWith("javascript", "");
  });

  it("checks Docker availability exactly once per runCode call", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await freshRunCode("javascript", "console.log(1);");
    expect(mockIsDockerAvailable).toHaveBeenCalledTimes(1);
  });

  it("returns a non-negative executionTimeMs on every path", async () => {
    process.env.ENABLE_CODE_EXEC = "true";
    vi.resetModules();
    const { runCode: freshRunCode } = await import("../code-sandbox");

    // Disabled path.
    mockIsDockerAvailable.mockResolvedValue(false);
    const r1 = await freshRunCode("javascript", "console.log('hi');");
    expect(r1.executionTimeMs).toBeGreaterThanOrEqual(0);

    // Docker path.
    mockIsDockerAvailable.mockResolvedValue(true);
    mockRunCodeDocker.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    const r2 = await freshRunCode("javascript", "console.log('hi');");
    expect(r2.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});
