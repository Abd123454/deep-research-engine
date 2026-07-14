// page reader — direct fetch + Mozilla Readability.
// no external APIs, no keys, no rate limits.

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type { PageReadResult } from "./types";

const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_CHARS = 6000; // reduced from 8000 to save tokens

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  // try Readability for clean extraction
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

  // fallback to regex
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

export async function readPage(url: string): Promise<PageReadResult> {
  if (shouldSkip(url)) {
    return { url, title: "", text: "", success: false, error: "skipped", tokensUsed: 0, wordCount: 0 };
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
      results[i] = await readPage(urls[i]);
    }
  }
  const c = Math.max(1, Math.min(concurrency, 6));
  await Promise.all(Array.from({ length: c }, () => worker()));
  return results;
}
