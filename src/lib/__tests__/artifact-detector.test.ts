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

describe("XSS sanitization in SVG artifacts", () => {
  // DOMPurify is a browser library — in Node test env we need jsdom.
  // We test the sanitization logic that ArtifactsPanel uses.
  it("detects SVG with malicious onload handler", () => {
    // SVG must be > 50 chars to be detected by artifact-detector.
    const malicious = '<svg onload="alert(1)" width="200" height="200"><circle cx="100" cy="100" r="50" fill="blue"/></svg>';
    const artifact = detectArtifact(malicious);
    expect(artifact).not.toBeNull();
    expect(artifact!.type).toBe("svg");
    // The detector extracts the raw SVG — sanitization happens at render time.
    expect(artifact!.content).toContain("onload");
  });

  it("detects SVG with embedded script tag", () => {
    const malicious = '<svg width="200" height="200"><script>alert("xss")</script><rect width="100" height="100" fill="red"/></svg>';
    const artifact = detectArtifact(malicious);
    expect(artifact).not.toBeNull();
    expect(artifact!.type).toBe("svg");
    expect(artifact!.content).toContain("<script>");
  });

  it("DOMPurify strips XSS vectors from SVG content (browser env)", async () => {
    // Skip in pure Node env (no window) — DOMPurify needs a DOM.
    if (typeof window === "undefined") {
      // Use jsdom to provide a DOM for DOMPurify.
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
      (globalThis as any).window = dom.window;
      (globalThis as any).document = dom.window.document;
      (globalThis as any).DOMParser = dom.window.DOMParser;
      (globalThis as any).NamedNodeMap = dom.window.NamedNodeMap;
    }

    const { default: DOMPurify } = await import("dompurify");
    const malicious = '<svg onload="alert(1)"><script>alert(2)</script><circle r="50"/></svg>';

    const clean = DOMPurify.sanitize(malicious, {
      USE_PROFILES: { svg: true, html: true },
      FORBID_TAGS: ["script", "object", "embed", "iframe", "link"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur"],
    });

    expect(clean).not.toContain("onload");
    expect(clean).not.toContain("<script>");
    // Safe SVG elements should survive.
    expect(clean).toContain("circle");
  });
});
