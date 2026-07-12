// Web page reader with multi-backend fallback — OPTIMIZED FOR SPEED.
//
// Primary: Z.AI page_reader (FREE, good content extraction).
// Fallback: direct HTTP fetch (FREE, no key, no quota).
//
// SPEED OPTIMIZATIONS:
//   - Short timeouts (8s ZAI, 10s direct) — fail fast, move on.
//   - Only 1 retry on Z.AI (was 2) — the fallback is instant.
//   - Skip PDFs and binary content immediately (no fetch attempt).
//   - Higher concurrency (up to 8 parallel reads).
//   - No inter-request stagger (was 250ms) — we want speed.
//   - Skip known-slow domains (rdia.gov.sa, etc.) that always timeout.

import ZAI from "z-ai-web-dev-sdk";
import type { PageReadResult } from "./types";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

// File extensions that are never useful as text content — skip them entirely
// to avoid wasting requests on images/videos/archives that would fail htmlToText.
const SKIP_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico",
  ".mp4", ".webm", ".mov", ".avi", ".mkv", ".mp3", ".wav", ".ogg", ".flac",
  ".zip", ".tar", ".gz", ".rar", ".7z", ".bz2",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".exe", ".dmg", ".apk", ".deb", ".rpm", ".msi",
  ".iso", ".img", ".bin",
];

// Domains that are known to be slow (gov sites, etc.) — skip them.
const SLOW_DOMAINS = [
  "rdia.gov.sa",
];

function isLikelySlowUrl(url: string): boolean {
  const lower = url.toLowerCase();
  // Skip binary/media/archive files entirely — they can't yield text and waste requests.
  if (SKIP_EXTENSIONS.some((ext) => lower.endsWith(ext) || lower.includes(ext + "?") || lower.includes(ext + "#"))) {
    return true;
  }
  return SLOW_DOMAINS.some((d) => lower.includes(d));
}

// Maximum acceptable response body size (10 MB). Prevents OOM from huge pages.
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;

// Convert HTML to readable plain text (best-effort, lightweight).
function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return m[1].replace(/<[^>]+>/g, "").trim().slice(0, 200);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, "").trim().slice(0, 200);
  return "";
}

function extractPublishedTime(html: string): string | undefined {
  const metas = [
    /property=["']og:article:published_time["']\s+content=["']([^"']+)["']/i,
    /property=["']article:published_time["']\s+content=["']([^"']+)["']/i,
    /name=["']date["']\s+content=["']([^"']+)["']/i,
    /name=["']publish_date["']\s+content=["']([^"']+)["']/i,
  ];
  for (const re of metas) {
    const m = html.match(re);
    if (m) return m[1];
  }
  const timeTag = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeTag) return timeTag[1];
  return undefined;
}

const MAX_TEXT_CHARS = 8000; // reduced from 12000 to speed up downstream LLM
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("503") ||
    m.includes("service unavailable")
  );
}

// ---------- Backend 1: Z.AI page_reader (with strict timeout) ----------

async function readPageZAI(url: string): Promise<PageReadResult> {
  // Only 1 retry — the direct-fetch fallback is instant.
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const zai = await getZAI();
      // Race the Z.AI call against a hard timeout.
      const result = (await Promise.race([
        zai.functions.invoke("page_reader", { url }),
        sleep(8000).then(() => {
          throw new Error("Z.AI page_reader timeout (8s)");
        }),
      ])) as {
        code?: number;
        status?: number;
        data?: {
          title?: string;
          url?: string;
          html?: string;
          publishedTime?: string;
          usage?: { tokens?: number };
        };
      };

      const data = result?.data;
      if (!data) throw new Error("Empty response from page_reader");

      const html = data.html ?? "";
      const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
      if (text.length <= 100) throw new Error("page_reader returned too little content");

      return {
        url: data.url ?? url,
        title: data.title ?? "",
        text,
        publishedTime: data.publishedTime,
        success: true,
        tokensUsed: data.usage?.tokens ?? 0,
        wordCount: countWords(text),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === 0 && isRetryableError(message)) {
        await sleep(1500); // short backoff, only once
        continue;
      }
      throw new Error(message);
    }
  }
  throw new Error("Z.AI page_reader failed");
}

// ---------- Backend 2: Direct HTTP fetch (FREE, fast) ----------

async function readPageDirect(url: string): Promise<PageReadResult> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(10000), // 10s hard timeout
  });

  if (!res.ok) {
    throw new Error(`Direct fetch failed (${res.status})`);
  }

  // OOM protection: reject responses larger than 10 MB BEFORE reading the body.
  const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_CONTENT_LENGTH) {
    throw new Error(
      `Response too large (${(contentLength / 1024 / 1024).toFixed(1)} MB > 10 MB limit)`
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("text/plain") &&
    !contentType.includes("application/xhtml")
  ) {
    throw new Error(`Unsupported content-type: ${contentType}`);
  }

  // Read at most MAX_CONTENT_LENGTH bytes from the stream (defense in depth:
  // even without a Content-Length header, we cap memory usage).
  const reader = res.body?.getReader();
  let html = "";
  if (reader) {
    const decoder = new TextDecoder("utf-8");
    let bytesRead = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_CONTENT_LENGTH) {
        await reader.cancel();
        throw new Error(
          `Response stream exceeded ${(MAX_CONTENT_LENGTH / 1024 / 1024).toFixed(0)} MB limit`
        );
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode(); // flush
  } else {
    html = await res.text();
    if (html.length > MAX_CONTENT_LENGTH) {
      throw new Error("Response body exceeded 10 MB limit");
    }
  }
  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
  if (text.length <= 100) throw new Error("Direct fetch yielded too little text");

  return {
    url,
    title: extractTitle(html),
    text,
    publishedTime: extractPublishedTime(html),
    success: true,
    tokensUsed: 0,
    wordCount: countWords(text),
  };
}

// ---------- Public API with fallback ----------

export async function readPage(url: string): Promise<PageReadResult> {
  // Skip PDFs and known-slow URLs entirely — they always timeout.
  if (isLikelySlowUrl(url)) {
    return {
      url,
      title: "",
      text: "",
      success: false,
      error: "Skipped (PDF or known-slow domain)",
      tokensUsed: 0,
      wordCount: 0,
    };
  }

  // Try Z.AI page_reader first (8s timeout, 1 retry).
  try {
    return await readPageZAI(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Only log non-timeout failures to reduce noise.
    if (!msg.includes("timeout")) {
      console.warn(
        `[page-reader] Z.AI failed for ${url.slice(0, 60)}: ${msg.slice(0, 80)} → direct fetch`
      );
    }
  }

  // Fallback: direct HTTP fetch (10s timeout).
  try {
    return await readPageDirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      url,
      title: "",
      text: "",
      success: false,
      error: msg,
      tokensUsed: 0,
      wordCount: 0,
    };
  }
}

// Read multiple pages with HIGH concurrency and NO stagger for speed.
export async function readPages(
  urls: string[],
  concurrency: number
): Promise<PageReadResult[]> {
  const results: PageReadResult[] = new Array(urls.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) return;
      results[i] = await readPage(urls[i]);
      // No delay between requests — we want maximum speed.
    }
  }

  // Use up to 8 concurrent workers (was capped at 6).
  const c = Math.max(1, Math.min(concurrency, 8));
  const workers: Promise<void>[] = [];
  for (let i = 0; i < c; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
