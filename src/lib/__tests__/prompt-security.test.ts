// Tests for sanitizeInput — XSS + command injection stripping.
// SQL keywords are NOT stripped (the LLM is not a SQL layer).

import { describe, it, expect } from "vitest";
import { sanitizeInput } from "../prompt-security";

describe("sanitizeInput: SQL keywords preserved", () => {
  it("keeps SELECT in legitimate SQL questions", () => {
    const result = sanitizeInput("How do I write a SELECT in SQL?");
    expect(result).toContain("SELECT");
    expect(result).toBe("How do I write a SELECT in SQL?");
  });

  it("strips INSERT (destructive SQL keyword)", () => {
    const result = sanitizeInput("INSERT INTO users VALUES");
    expect(result).not.toContain("INSERT");
  });

  it("strips DROP (destructive SQL keyword)", () => {
    const result = sanitizeInput("What does DROP TABLE do?");
    expect(result).not.toContain("DROP");
  });

  it("strips UPDATE (destructive SQL keyword)", () => {
    const result = sanitizeInput("How to use UPDATE statement");
    expect(result).not.toContain("UPDATE");
  });

  it("strips DELETE (destructive SQL keyword)", () => {
    const result = sanitizeInput("DELETE vs TRUNCATE difference");
    expect(result).not.toContain("DELETE");
  });
});

describe("sanitizeInput: shell separators + SQL injection stripped", () => {
  it("strips semicolons, DROP, and -- from SQL injection", () => {
    const result = sanitizeInput("'; DROP TABLE users; --");
    expect(result).not.toContain(";");
    expect(result).not.toContain("DROP");
    expect(result).not.toContain("--");
    expect(result).toContain("TABLE");
  });

  it("strips pipe (|)", () => {
    const result = sanitizeInput("cat file | grep test");
    expect(result).not.toContain("|");
  });

  it("strips ampersand (&)", () => {
    const result = sanitizeInput("cmd1 && cmd2");
    expect(result).not.toContain("&");
  });
});

describe("sanitizeInput: command substitution stripped", () => {
  it("strips $(...) command substitution", () => {
    const result = sanitizeInput("run $(whoami) now");
    expect(result).not.toContain("$(whoami)");
    expect(result).toContain("run");
    expect(result).toContain("now");
  });

  it("strips backtick command substitution", () => {
    const result = sanitizeInput("use `cat file` here");
    expect(result).not.toContain("`cat file`");
    expect(result).toContain("use");
    expect(result).toContain("here");
  });
});

describe("sanitizeInput: command names (context-aware)", () => {
  it("strips 'rm ' when followed by space (command context)", () => {
    const result = sanitizeInput("test; rm -rf /");
    // Semicolon stripped, "rm " (with space) stripped
    expect(result).not.toContain(";");
    expect(result).not.toMatch(/\brm\s/);
  });

  it("keeps 'curl' without trailing space (word in sentence)", () => {
    const result = sanitizeInput("I like curling");
    expect(result).toContain("curling");
  });

  it("strips 'curl ' when followed by space (command context)", () => {
    const result = sanitizeInput("curl http://example.com");
    expect(result).not.toMatch(/\bcurl\s/);
  });

  it("strips 'sudo ' when followed by space", () => {
    const result = sanitizeInput("sudo apt install");
    expect(result).not.toMatch(/\bsudo\s/);
  });
});

describe("sanitizeInput: XSS stripped", () => {
  it("strips <script> tags and their content", () => {
    const result = sanitizeInput("<script>alert(1)</script>");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert(1)");
    expect(result).toBe("");
  });

  it("strips event handlers", () => {
    const result = sanitizeInput('<img onclick="evil()">');
    expect(result).not.toContain('onclick=');
  });

  it("strips javascript: URLs", () => {
    const result = sanitizeInput("javascript:alert(1)");
    expect(result).not.toContain("javascript:");
  });

  it("strips <iframe> tags", () => {
    const result = sanitizeInput('<iframe src="evil.com"></iframe>');
    expect(result).not.toContain("<iframe");
  });

  it("strips <embed> tags", () => {
    const result = sanitizeInput('<embed src="evil.swf">');
    expect(result).not.toContain("<embed");
  });
});

describe("sanitizeInput: legitimate queries unchanged", () => {
  it("normal research query passes through", () => {
    const result = sanitizeInput("What is quantum computing?");
    expect(result).toBe("What is quantum computing?");
  });

  it("Arabic query passes through", () => {
    const result = sanitizeInput("ما هو الذكاء الاصطناعي؟");
    expect(result).toBe("ما هو الذكاء الاصطناعي؟");
  });

  it("query with quotes passes through (quotes not stripped)", () => {
    const result = sanitizeInput("What does 'AI' mean?");
    // Quotes are no longer stripped (SQL_PATTERNS removed)
    expect(result).toContain("'");
  });

  it("query with angle brackets in text", () => {
    // < and > are NOT in CMD_PATTERNS anymore (only ;|&)
    const result = sanitizeInput("Compare < vs > operators");
    expect(result).toContain("<");
    expect(result).toContain(">");
  });
});
