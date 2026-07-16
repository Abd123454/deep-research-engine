// Tests for file-generator.ts

import { describe, it, expect } from "vitest";
import { generateFile } from "../file-generator";

describe("file-generator", () => {
  it("generates PDF with valid header", async () => {
    const result = await generateFile({ type: "pdf", title: "Test", content: "# Hello\n\nWorld" });
    expect(result.mimeType).toBe("application/pdf");
    expect(result.filename).toBe("Test.pdf");
    expect(result.size).toBeGreaterThan(0);
    expect(result.key).toBe("generated/anonymous/Test.pdf");
    expect(decodeURIComponent(result.url)).toContain("generated/anonymous/Test.pdf");
  });

  it("generates DOCX with valid header (PK = ZIP)", async () => {
    const result = await generateFile({ type: "docx", title: "Test Doc", content: "# Hello\n\nWorld" });
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(result.filename).toBe("Test_Doc.docx");
    expect(result.size).toBeGreaterThan(0);
    expect(result.key).toBe("generated/anonymous/Test_Doc.docx");
    expect(decodeURIComponent(result.url)).toContain("Test_Doc.docx");
  });

  it("generates PPTX with valid header", async () => {
    const result = await generateFile({ type: "pptx", title: "Slides", content: "## Slide 1\n- Point A\n- Point B" });
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(result.filename).toBe("Slides.pptx");
    expect(result.size).toBeGreaterThan(0);
  });

  it("generates XLSX from CSV content", async () => {
    const result = await generateFile({ type: "xlsx", title: "Data", content: "Name,Age\nAlice,30\nBob,25" });
    expect(result.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.filename).toBe("Data.xlsx");
    expect(result.size).toBeGreaterThan(0);
  });

  it("generates MD as plain text", async () => {
    const result = await generateFile({ type: "md", title: "Notes", content: "# Hello World" });
    expect(result.mimeType).toBe("text/markdown");
    expect(result.filename).toBe("Notes.md");
    expect(result.size).toBe("# Hello World".length);
  });

  it("sanitizes filename (special chars removed)", async () => {
    const result = await generateFile({ type: "md", title: "Test/File?:Name", content: "x" });
    expect(result.filename).toBe("Test_File__Name.md");
  });

  it("namespaces S3 key by userId", async () => {
    const result = await generateFile({
      type: "md",
      title: "Notes",
      content: "x",
      userId: "user-42",
    });
    expect(result.key).toBe("generated/user-42/Notes.md");
    expect(decodeURIComponent(result.url)).toContain("generated/user-42/Notes.md");
  });

  it("returns a local fallback URL when S3 is not configured", async () => {
    // S3_ACCESS_KEY_ID is unset in the test env, so we expect the local URL.
    const result = await generateFile({ type: "md", title: "Local", content: "x" });
    expect(result.url).toContain("/api/files/local/");
  });
});
