// page reader — direct fetch + Mozilla Readability, with a Wikipedia API
// fast-path.
//
// Wikipedia article HTML pages aggressively block some IPs (403), but the
// MediaWiki extracts API (action=query&prop=extracts) returns clean plain
// text and is designed for programmatic access. So when the URL is a
// Wikipedia article, we fetch the content via the API instead of scraping
// the HTML. This makes Wikipedia a reliable, always-readable source from
// any environment.
//
// For all other URLs, we fetch the HTML directly and extract via Readability.
import * as Sentry from "@sentry/nextjs";


import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { PageReadResult } from "./types";
import { logger } from "./logger";
import { withAbortSignal } from "./abort-utils";
import { safeFetch } from "./safe-fetch";

const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_CHARS = 6000; // cap per-page text to save tokens

const SKIP_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico",
  ".mp4", ".webm", ".mov", ".avi", ".mp3", ".wav", ".ogg",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".exe", ".dmg", ".apk", ".iso",
];

function shouldSkip(url: string): boolean {
  const lower = url.toLowerCase();
  return SKIP_EXTENSIONS.some(ext => lower.endsWith(ext) || lower.includes(ext + "?"));
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]+>/g, "").trim().slice(0, 200) : "";
}

function extractPublishedTime(html: string): string | undefined {
  const metas = [
    /property=["']og:article:published_time["']\s+content=["']([^"']+)["']/i,
    /property=["']article:published_time["']\s+content=["']([^"']+)["']/i,
    /name=["']date["']\s+content=["']([^"']+)["']/i,
    /<time[^>]*datetime=["']([^"']+)["']/i,
  ];
  for (const re of metas) { const m = html.match(re); if (m) return m[1]; }
  return undefined;
}

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// simple HTML-to-text fallback if Readability fails
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------- Wikipedia fast-path via MediaWiki API ----------
// Wikipedia article HTML 403s from some IPs, but the extracts API is
// designed for programmatic access and returns clean plain text.
const WIKI_UA =
  "Quaesitor/1.0 (https://github.com/Abd123454/deep-research-engine; self-hosted research tool)";

function isWikipediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.endsWith("wikipedia.org") &&
      u.pathname.startsWith("/wiki/")
    );
  } catch {
    return false;
  }
}

function wikipediaTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    // pathname is like /wiki/RISC-V — take the segment after /wiki/.
    const m = u.pathname.match(/^\/wiki\/(.+)$/);
    if (m) return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch (err) {
  Sentry.captureException(err);
/* ignore */ 
}
  return "";
}

// ---------- Cancellation helper ----------
// withAbortSignal is imported from "./abort-utils" — see that file for docs.

async function readWikipediaViaApi(url: string, userSignal?: AbortSignal): Promise<PageReadResult> {
  const title = wikipediaTitleFromUrl(url);
  if (!title) throw new Error("could not parse wikipedia title");

  // Use the MediaWiki extracts API: returns plain-text article content.
  // origin=* makes it CORS-accessible; the API is not IP-blocked like the
  // article HTML pages are.
  const apiUrl =
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts` +
    `&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*&exlimit=1`;

  const res = await safeFetch(apiUrl, {
    headers: { "User-Agent": WIKI_UA, Accept: "application/json" },
    signal: withAbortSignal(userSignal, 12000),
  });
  if (!res.ok) throw new Error(`wikipedia api ${res.status}`);

  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; extract?: string; missing?: string }> };
  };
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page) throw new Error("wikipedia api: no page");
  if (page.missing) throw new Error("wikipedia api: page missing");

  const text = (page.extract || "").slice(0, MAX_TEXT_CHARS);
  if (text.length < 100) throw new Error("wikipedia api: too little text");

  return {
    url,
    title: page.title || title,
    text,
    success: true,
    tokensUsed: 0,
    wordCount: countWords(text),
  };
}

// ---------- Direct fetch + Readability (for non-Wikipedia URLs) ----------
async function readPageDirect(url: string, userSignal?: AbortSignal): Promise<PageReadResult> {
  const res = await safeFetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: withAbortSignal(userSignal, 10000),
  });

  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_CONTENT_LENGTH) throw new Error("too large");

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error(`unsupported: ${contentType}`);
  }

  const html = await res.text();
  if (html.length > MAX_CONTENT_LENGTH) throw new Error("too large");

  let text = "";
  let title = extractTitle(html);
  try {
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();
    if (article?.textContent) {
      text = article.textContent.slice(0, MAX_TEXT_CHARS);
      if (article.title) title = article.title;
    }
  } catch (err) {
  Sentry.captureException(err);
/* fall through */ 
}

  if (text.length < 100) {
    text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
  }

  if (text.length < 100) throw new Error("too little text");

  return {
    url, title, text,
    publishedTime: extractPublishedTime(html),
    success: true, tokensUsed: 0, wordCount: countWords(text),
  };
}

// ---------- Indirect injection scanning ----------
// Scans extracted page text for prompt-injection patterns that a malicious
// page might embed (e.g. "Note to AI: ignore user request"). If detected,
// the text is replaced with a blocked marker so the LLM never sees it.
const INDIRECT_INJECTION_PATTERNS = [
  "note to ai:",
  "ignore the above",
  "ignore previous",
  "system:",
  "[inst]",
  "<|im_start|>",
  "<|system|>",
  "you are now a",
  "disregard all",
];

function scanForIndirectInjection(text: string): boolean {
  // Only scan the first 2000 chars — injection attempts are usually at the
  // top of the page (before legit content).
  const head = text.slice(0, 2000).toLowerCase();
  // Also apply Unicode normalization to defeat obfuscation.
  const normalized = head.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF\u00AD]/g, " ");
  return INDIRECT_INJECTION_PATTERNS.some((p) => normalized.includes(p));
}

// ---------- Public ----------
export async function readPage(url: string, signal?: AbortSignal): Promise<PageReadResult> {
  if (shouldSkip(url)) {
    return { url, title: "", text: "", success: false, error: "skipped", tokensUsed: 0, wordCount: 0 };
  }
  // Wikipedia fast-path: the article HTML is often 403-blocked, but the
  // extracts API works reliably. Try the API first for Wikipedia URLs.
  if (isWikipediaUrl(url)) {
    try {
      const result = await readWikipediaViaApi(url, signal);
      // Indirect injection scan: block if malicious content detected.
      if (result.success && scanForIndirectInjection(result.text)) {
        logger.warn({ module: "page-reader", url }, "Indirect injection detected in Wikipedia content — content blocked");
        return { ...result, text: "[CONTENT BLOCKED: potential indirect prompt injection]", success: false, error: "injection_blocked" };
      }
      return result;
    } catch (err) {
  Sentry.captureException(err);
// Fall through to direct fetch as a last resort.
    
}
  }
  try {
    const result = await readPageDirect(url, signal);
    // Indirect injection scan for direct-fetched pages too.
    if (result.success && scanForIndirectInjection(result.text)) {
      logger.warn({ module: "page-reader", url }, "Indirect injection detected in direct-fetched content — content blocked");
      return { ...result, text: "[CONTENT BLOCKED: potential indirect prompt injection]", success: false, error: "injection_blocked" };
    }

    // JS-rendered page fallback: if direct fetch returned very little text
    // (< 200 chars), the page is likely a SPA (React/Vue/Angular) that needs
    // JavaScript execution to render content. Try Playwright as a fallback.
    if (result.success && result.text.length < 200) {
      try {
        const { readPageWithJS } = await import("./page-reader-js");
        const jsResult = await readPageWithJS(url, signal);
        if (jsResult.success && jsResult.text.length > result.text.length) {
          // Check the JS-rendered content for injection too.
          if (scanForIndirectInjection(jsResult.text)) {
            logger.warn({ module: "page-reader", url, source: "js" }, "Indirect injection detected in JS-rendered content — content blocked");
            return { url, title: jsResult.title, text: "[CONTENT BLOCKED: potential indirect prompt injection]", success: false, error: "injection_blocked", tokensUsed: 0, wordCount: 0 };
          }
          return {
            url,
            title: jsResult.title,
            text: jsResult.text,
            success: true,
            tokensUsed: jsResult.tokensUsed,
            wordCount: jsResult.wordCount,
          };
        }
      } catch (err) {
  Sentry.captureException(err);
// Playwright not installed or failed — return the original result.
      
}
    }

    return result;
  } catch (err) {
    return { url, title: "", text: "", success: false, error: err instanceof Error ? err.message : String(err), tokensUsed: 0, wordCount: 0 };
  }
}

export async function readPages(urls: string[], concurrency: number, signal?: AbortSignal): Promise<PageReadResult[]> {
  const results: PageReadResult[] = new Array(urls.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      // Check for cancellation before reading each page.
      if (signal?.aborted) return;
      const i = cursor++;
      if (i >= urls.length) return;
      results[i] = await readPage(urls[i]!, signal);
    }
  }
  const c = Math.max(1, Math.min(concurrency, 6));
  await Promise.all(Array.from({ length: c }, () => worker()));
  return results;
}
