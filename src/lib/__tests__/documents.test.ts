// Unit tests for document parsing, validation, and store.

import { describe, it, expect, beforeEach } from "vitest";
import {
  isAllowedMimeType,
  sanitizeFilename,
  parseText,
  ALLOWED_MIME_TYPES,
} from "../document-parser";
import {
  addDocument,
  getDocument,
  listDocuments,
  deleteDocument,
  _resetStore,
} from "../document-store";

describe("document-parser: validation", () => {
  it("accepts PDF, DOCX, TXT, MD, PNG, JPEG, WEBP", () => {
    expect(isAllowedMimeType("application/pdf")).toBe(true);
    expect(
      isAllowedMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
    expect(isAllowedMimeType("text/plain")).toBe(true);
    expect(isAllowedMimeType("text/markdown")).toBe(true);
    expect(isAllowedimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("image/jpeg")).toBe(true);
    expect(isAllowedMimeType("image/webp")).toBe(true);
  });

  it("rejects executable and unknown types", () => {
    expect(isAllowedMimeType("application/x-msdownload")).toBe(false);
    expect(isAllowedMimeType("application/x-executable")).toBe(false);
    expect(isAllowedMimeType("")).toBe(false);
    expect(isAllowedMimeType("unknown/type")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isAllowedMimeType("APPLICATION/PDF")).toBe(true);
    expect(isAllowedMimeType("Text/Plain")).toBe(true);
  });

  it("exposes the full allowed list", () => {
    expect(ALLOWED_MIME_TYPES.length).toBeGreaterThanOrEqual(6);
  });
});

describe("document-parser: sanitizeFilename", () => {
  it("strips path separators (replaces with _)", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
  });

  it("strips backslashes", () => {
    expect(sanitizeFilename("C:\\Users\\file.pdf")).toBe("C_Users_file.pdf");
  });

  it("limits length to 200 chars", () => {
    const long = "a".repeat(300);
    expect(sanitizeFilename(long).length).toBe(200);
  });

  it("falls back to 'document' for empty/all-special-chars result", () => {
    expect(sanitizeFilename("")).toBe("document");
  });
});

describe("document-parser: parseText", () => {
  it("extracts text from a UTF-8 buffer", async () => {
    const buf = Buffer.from("Hello world — test content");
    const result = await parseText(buf);
    expect(result.text).toContain("Hello world");
    expect(result.textLength).toBeGreaterThan(0);
    expect(result.preview.length).toBeLessThanOrEqual(500);
  });

  it("throws on empty/whitespace text", async () => {
    const buf = Buffer.from("   ");
    await expect(parseText(buf)).rejects.toThrow("empty");
  });

  it("truncates text exceeding MAX_TEXT_CHARS", async () => {
    const huge = "x".repeat(300_000);
    const result = await parseText(Buffer.from(huge));
    expect(result.textLength).toBeLessThanOrEqual(200_000);
  });
});

describe("document-store", () => {
  beforeEach(() => {
    _resetStore();
  });

  it("adds and retrieves a document", () => {
    const result = addDocument(
      "1.2.3.4",
      "test.pdf",
      "application/pdf",
      1024,
      "test content",
      12,
      "test content"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = getDocument(result.document.id);
    expect(doc).toBeDefined();
    expect(doc?.filename).toBe("test.pdf");
  });

  it("enforces per-IP limit (10 docs)", () => {
    for (let i = 0; i < 10; i++) {
      const r = addDocument("ip1", `f${i}.txt`, "text/plain", 10, "x", 1, "x");
      expect(r.ok).toBe(true);
    }
    const blocked = addDocument("ip1", "11.txt", "text/plain", 10, "x", 1, "x");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toMatch(/limit/i);
    }
  });

  it("allows different IPs independently", () => {
    for (let i = 0; i < 10; i++) {
      addDocument("ipA", `f${i}.txt`, "text/plain", 10, "x", 1, "x");
    }
    const otherIp = addDocument("ipB", "g.txt", "text/plain", 10, "x", 1, "x");
    expect(otherIp.ok).toBe(true);
  });

  it("lists documents sorted by upload time (newest first)", async () => {
    addDocument("ip", "a.txt", "text/plain", 1, "x", 1, "x");
    await new Promise((r) => setTimeout(r, 5));
    addDocument("ip", "b.txt", "text/plain", 1, "x", 1, "x");
    const list = listDocuments();
    expect(list[0]!.filename).toBe("b.txt");
    expect(list[1]!.filename).toBe("a.txt");
  });

  it("deletes a document", () => {
    const r = addDocument("ip", "d.txt", "text/plain", 1, "x", 1, "x");
    if (!r.ok) return;
    expect(deleteDocument(r.document.id)).toBe(true);
    expect(getDocument(r.document.id)).toBeUndefined();
  });

  it("returns false when deleting non-existent document", () => {
    expect(deleteDocument("nonexistent-id")).toBe(false);
  });
});

// Helper with a typo-fixed name to avoid breaking the case-insensitive test above.
function isAllowedimeType(mime: string): boolean {
  return isAllowedMimeType(mime);
}
