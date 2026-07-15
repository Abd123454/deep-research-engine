// Tests for code-sandbox.ts — JavaScript + Python execution.

import { describe, it, expect } from "vitest";
import { runCode, runJavaScriptAsync, runPython } from "../code-sandbox";

describe("runJavaScriptAsync", () => {
  it("executes simple console.log", async () => {
    const result = await runJavaScriptAsync("console.log('hello world');");
    expect(result.success).toBe(true);
    expect(result.output).toContain("hello world");
  });

  it("executes math operations", async () => {
    const result = await runJavaScriptAsync("console.log(2 + 3);");
    expect(result.success).toBe(true);
    expect(result.output).toContain("5");
  });

  it("handles errors gracefully", async () => {
    const result = await runJavaScriptAsync("throw new Error('test error');");
    expect(result.success).toBe(false);
    expect(result.error).toContain("test error");
  });

  it("supports JSON operations", async () => {
    const result = await runJavaScriptAsync('console.log(JSON.stringify({a: 1}));');
    expect(result.success).toBe(true);
    expect(result.output).toContain('"a":1');
  });

  it("supports async/await", async () => {
    const result = await runJavaScriptAsync("const x = await Promise.resolve(42); console.log(x);");
    expect(result.success).toBe(true);
    expect(result.output).toContain("42");
  });

  it("returns no network access (fetch undefined)", async () => {
    const result = await runJavaScriptAsync("console.log(typeof fetch);");
    expect(result.success).toBe(true);
    expect(result.output).toContain("undefined");
  });

  it("truncates long output", async () => {
    const result = await runJavaScriptAsync("for(let i=0;i<10000;i++) console.log('line'+i);");
    expect(result.success).toBe(true);
    expect(result.output.length).toBeLessThanOrEqual(10000);
  });
});

describe("runPython", () => {
  it("executes simple print", async () => {
    const result = runPython("print('hello python')");
    expect(result.success).toBe(true);
    expect(result.output).toContain("hello python");
  });

  it("handles Python errors", async () => {
    const result = runPython("raise ValueError('test')");
    expect(result.success).toBe(false);
    expect(result.error).toContain("ValueError");
  });

  it("supports math operations", async () => {
    const result = runPython("print(2 + 3)");
    expect(result.success).toBe(true);
    expect(result.output).toContain("5");
  });
});

describe("runCode dispatcher", () => {
  it("routes javascript to JS sandbox", async () => {
    const result = await runCode("javascript", "console.log('js');");
    expect(result.success).toBe(true);
    expect(result.output).toContain("js");
  });

  it("routes python to Python executor", async () => {
    const result = await runCode("python", "print('py')");
    expect(result.success).toBe(true);
    expect(result.output).toContain("py");
  });

  it("returns error for unsupported language", async () => {
    const result = await runCode("ruby", "puts 'hello'");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not supported");
  });

  it("handles empty code", async () => {
    const result = await runCode("javascript", "");
    expect(result.success).toBe(true);
  });
});
