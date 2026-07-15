// Tests for artifact-detector.ts — detect extractable content from LLM responses.

import { describe, it, expect } from "vitest";
import { detectArtifact } from "../artifact-detector";

describe("detectArtifact", () => {
  it("detects HTML blocks", () => {
    const response = "Here's a page:\n```html\n<div>Hello</div>\n```";
    const result = detectArtifact(response);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("html");
    expect(result!.content).toContain("<div>");
  });

  it("detects JSX/React blocks", () => {
    const response = "```jsx\nfunction App() { return <h1>Hello</h1>; }\n```";
    const result = detectArtifact(response);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("react");
  });

  it("detects SVG tags", () => {
    const response = "Here's a diagram:\n<svg width=\"100\" height=\"100\"><circle cx=\"50\" cy=\"50\" r=\"40\"/></svg>";
    const result = detectArtifact(response);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("svg");
  });

  it("detects long code blocks as code artifact", () => {
    const longCode = "```python\n" + "x = 1\n".repeat(30) + "```";
    const result = detectArtifact(longCode);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("code");
    expect(result!.language).toBe("python");
  });

  it("detects research reports with ## Sources", () => {
    const response = "# Report\n\n## Introduction\n\nSome text.\n\n## Sources\n\n[1] https://example.com";
    const result = detectArtifact(response);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("research_report");
  });

  it("detects long markdown documents", () => {
    const response = "# Title\n\n## Section 1\n\n" + "Lorem ipsum ".repeat(60) + "\n\n## Section 2\n\nMore text.";
    const result = detectArtifact(response);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("markdown");
  });

  it("returns null for short responses", () => {
    expect(detectArtifact("Hello world")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectArtifact("")).toBeNull();
  });

  it("returns null for short text without code blocks", () => {
    expect(detectArtifact("This is a short answer without any artifacts.")).toBeNull();
  });

  it("detects first HTML block when multiple exist", () => {
    const response = "```html\n<div>First</div>\n```\nSome text\n```html\n<div>Second</div>\n```";
    const result = detectArtifact(response);
    expect(result).not.toBeNull();
    expect(result!.content).toContain("First");
    expect(result!.content).not.toContain("Second");
  });
});
