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

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { PageReadResult } from "./types";

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
  "DeepResearchEngine/1.0 (https://github.com/Abd123454/deep-research-engine; self-hosted research tool)";

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
  } catch { /* ignore */ }
  return "";
}

async function readWikipediaViaApi(url: string): Promise<PageReadResult> {
  const title = wikipediaTitleFromUrl(url);
  if (!title) throw new Error("could not parse wikipedia title");

  // Use the MediaWiki extracts API: returns plain-text article content.
  // origin=* makes it CORS-accessible; the API is not IP-blocked like the
  // article HTML pages are.
  const apiUrl =
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts` +
    `&explaintext&titles=${encodeURIComponent(title)}&format=json&origin=*&exlimit=1`;

  const res = await fetch(apiUrl, {
    headers: { "User-Agent": WIKI_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
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
async function readPageDirect(url: string): Promise<PageReadResult> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
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
  } catch { /* fall through */ }

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

// ---------- Public ----------
export async function readPage(url: string): Promise<PageReadResult> {
  if (shouldSkip(url)) {
    return { url, title: "", text: "", success: false, error: "skipped", tokensUsed: 0, wordCount: 0 };
  }
  // Wikipedia fast-path: the article HTML is often 403-blocked, but the
  // extracts API works reliably. Try the API first for Wikipedia URLs.
  if (isWikipediaUrl(url)) {
    try {
      return await readWikipediaViaApi(url);
    } catch (err) {
      // Fall through to direct fetch as a last resort.
      // (In environments where the API is also blocked, direct fetch may
      // still work; in environments where HTML is blocked, the API already
      // succeeded above.)
    }
  }
  try {
    return await readPageDirect(url);
  } catch (err) {
    return { url, title: "", text: "", success: false, error: err instanceof Error ? err.message : String(err), tokensUsed: 0, wordCount: 0 };
  }
}

export async function readPages(urls: string[], concurrency: number): Promise<PageReadResult[]> {
  const results: PageReadResult[] = new Array(urls.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) return;
      results[i] = await readPage(urls[i]!);
    }
  }
  const c = Math.max(1, Math.min(concurrency, 6));
  await Promise.all(Array.from({ length: c }, () => worker()));
  return results;
}
