// Web page reader adapter using Z.AI page_reader (FREE, built-in).
//
// The z-ai-web-dev-sdk page_reader returns:
//   { code, status, data: { title, url, html, publishedTime, usage: { tokens } } }

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

export async function readPage(
  url: string,
  retries = 3
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
        return {
          url,
          title: "",
          text: "",
          success: false,
          error: "Empty response from page_reader",
          tokensUsed: 0,
          wordCount: 0,
        };
      }

      const html = data.html ?? "";
      const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
      const wordCount = countWords(text);

      return {
        url: data.url ?? url,
        title: data.title ?? "",
        text,
        publishedTime: data.publishedTime,
        success: text.length > 100, // require some minimal content
        tokensUsed: data.usage?.tokens ?? 0,
        wordCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastErr = message;

      // If retryable and we still have attempts left, wait and retry.
      if (attempt < retries && isRetryableError(message)) {
        // Exponential backoff: 2s, 4s, 8s
        const delayMs = 2000 * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }
      break;
    }
  }

  return {
    url,
    title: "",
    text: "",
    success: false,
    error: lastErr,
    tokensUsed: 0,
    wordCount: 0,
  };
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
