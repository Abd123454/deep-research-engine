// Web page reader with multi-backend fallback.
//
// Primary: Z.AI page_reader (FREE, good content extraction).
// Fallback: direct HTTP fetch + HTML-to-text (FREE, no key, no quota).
//
// If Z.AI page_reader hits 429 rate limits, the engine automatically falls
// back to a direct fetch of the URL and extracts text from the raw HTML.
// This ensures page reading NEVER stalls due to rate limiting.

import ZAI from "z-ai-web-dev-sdk";
import type { PageReadResult } from "./types";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

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

// Extract the <title> from raw HTML.
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return m[1].replace(/<[^>]+>/g, "").trim().slice(0, 200);
  // Fallback: first <h1>
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, "").trim().slice(0, 200);
  return "";
}

// Extract a published-time hint from meta tags (og:article:published_time,
// article:published_time, or <time datetime="...">).
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

// Cap the text length we keep for downstream LLM consumption.
const MAX_TEXT_CHARS = 12000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("503") ||
    m.includes("service unavailable") ||
    m.includes("timeout") ||
    m.includes("temporarily")
  );
}

// ---------- Backend 1: Z.AI page_reader ----------

async function readPageZAI(
  url: string,
  retries = 2
): Promise<PageReadResult> {
  let lastErr: string = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const zai = await getZAI();
      const result = (await zai.functions.invoke("page_reader", { url })) as {
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
      if (!data) {
        throw new Error("Empty response from page_reader");
      }

      const html = data.html ?? "";
      const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
      const wordCount = countWords(text);

      if (text.length <= 100) {
        throw new Error("page_reader returned too little content");
      }

      return {
        url: data.url ?? url,
        title: data.title ?? "",
        text,
        publishedTime: data.publishedTime,
        success: true,
        tokensUsed: data.usage?.tokens ?? 0,
        wordCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastErr = message;
      if (attempt < retries && isRetryableError(message)) {
        // Exponential backoff: 2s, 4s
        const delayMs = 2000 * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }
      break;
    }
  }
  throw new Error(lastErr);
}

// ---------- Backend 2: Direct HTTP fetch (FREE, no key, no quota) ----------

async function readPageDirect(url: string): Promise<PageReadResult> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000), // 15s timeout
  });

  if (!res.ok) {
    throw new Error(`Direct fetch failed (${res.status} ${res.statusText})`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("text/plain") &&
    !contentType.includes("application/xhtml")
  ) {
    // Skip binary content (PDFs, images, etc.)
    throw new Error(`Unsupported content-type: ${contentType}`);
  }

  const html = await res.text();
  const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
  const wordCount = countWords(text);
  const title = extractTitle(html);
  const publishedTime = extractPublishedTime(html);

  if (text.length <= 100) {
    throw new Error("Direct fetch yielded too little text content");
  }

  return {
    url,
    title,
    text,
    publishedTime,
    success: true,
    tokensUsed: 0,
    wordCount,
  };
}

// ---------- Public API with fallback chain ----------

export async function readPage(url: string): Promise<PageReadResult> {
  // Try Z.AI page_reader first (better content extraction).
  try {
    return await readPageZAI(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[page-reader] Z.AI page_reader failed for ${url}: ${msg.slice(0, 120)} → falling back to direct fetch`
    );
  }

  // Fallback: direct HTTP fetch (FREE, no quota).
  try {
    const result = await readPageDirect(url);
    if (result.success) {
      console.log(
        `[page-reader] Direct fetch succeeded for ${url} (${result.wordCount} words)`
      );
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      url,
      title: "",
      text: "",
      success: false,
      error: `Both backends failed. Z.AI error + Direct fetch error: ${msg}`,
      tokensUsed: 0,
      wordCount: 0,
    };
  }
}

// Read multiple pages with bounded concurrency and a small inter-request delay
// to be friendly to rate limits on the underlying page_reader API.
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
      // Small stagger between requests within a worker to reduce burst load.
      await sleep(250);
    }
  }

  const workers: Promise<void>[] = [];
  const c = Math.max(1, Math.min(concurrency, 6));
  for (let i = 0; i < c; i++) {
    // Stagger worker start times to smooth out the initial burst.
    if (i > 0) await sleep(150);
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
