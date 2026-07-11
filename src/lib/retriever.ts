// Retriever (search engine) adapters with multi-engine fallback chain.
//
// Supports:
//   - "tavily":     Tavily API (1000 free searches/month, recommended primary)
//   - "zai":        built-in Z.AI web_search (FREE, no key needed)
//   - "duckduckgo": DuckDuckGo Lite HTML scraping (FREE, no key, no quota)
//
// Fallback chain: when SEARCH_FALLBACK_ENABLED=true, the engine tries the
// primary retriever first, then falls back to the others in order:
//   tavily → zai → duckduckgo
// This ensures the research NEVER stops due to a single search engine outage
// or quota exhaustion.

import ZAI from "z-ai-web-dev-sdk";
import type { RetrieverType, SearchResultItem } from "./types";

function env(key: string, fallback = ""): string {
  if (typeof process === "undefined") return fallback;
  return (process.env?.[key] ?? fallback).trim();
}

function envBool(key: string, fallback: boolean): boolean {
  if (typeof process === "undefined") return fallback;
  const raw = process.env?.[key];
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

export function getRetriever(): RetrieverType {
  const v = env("RETRIEVER", "tavily").toLowerCase() as RetrieverType;
  if (v === "tavily" && !env("TAVILY_API_KEY")) return "zai";
  return v;
}

function isFallbackEnabled(): boolean {
  return envBool("SEARCH_FALLBACK_ENABLED", true);
}

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableSearchError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("503") ||
    m.includes("service unavailable") ||
    m.includes("timeout") ||
    m.includes("temporarily") ||
    m.includes("overloaded")
  );
}

// ---------- Z.AI web_search ----------

async function zaiSearch(
  query: string,
  num: number,
  retries = 1
): Promise<SearchResultItem[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const zai = await getZAI();
      // Race against a hard 10s timeout.
      const results = (await Promise.race([
        zai.functions.invoke("web_search", {
          query,
          num: Math.min(Math.max(num, 1), 30),
        }),
        sleep(10000).then(() => {
          throw new Error("Z.AI web_search timeout (10s)");
        }),
      ])) as SearchResultItem[];
      if (!Array.isArray(results)) return [];
      return results.map((r: SearchResultItem, i: number) => ({
        url: r.url,
        name: r.name,
        snippet: r.snippet,
        host_name: r.host_name,
        rank: r.rank ?? i + 1,
        date: r.date ?? "",
        favicon: r.favicon ?? "",
      }));
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < retries && isRetryableSearchError(msg)) {
        await sleep(1500); // short backoff
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

// ---------- Tavily ----------

async function tavilySearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  const apiKey = env("TAVILY_API_KEY");
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set.");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(num, 30),
      search_depth: "advanced",
      include_answer: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily search failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    results?: {
      url?: string;
      title?: string;
      content?: string;
      score?: number;
    }[];
  };
  return (data.results ?? []).map((r, i) => {
    let host = "";
    try {
      host = r.url ? new URL(r.url).hostname : "";
    } catch {
      host = "";
    }
    return {
      url: r.url ?? "",
      name: r.title ?? "",
      snippet: r.content ?? "",
      host_name: host,
      rank: i + 1,
      date: "",
      favicon: "",
    };
  });
}

// ---------- DuckDuckGo (FREE, no key, no quota) ----------
//
// Uses DuckDuckGo Lite (html.duckduckgo.com) which returns simple HTML
// without JavaScript. We parse the result links and snippets.
// This is the ultimate free fallback — unlimited, no API key, no quota.

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function duckduckgoSearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  const url = "https://html.duckduckgo.com/html/";
  const body = new URLSearchParams({
    q: query,
    kp: "-2", // safe search off
    kl: "us-en",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed (${res.status})`);
  }

  const html = await res.text();
  const results: SearchResultItem[] = [];

  // DuckDuckGo Lite HTML structure:
  //   <a class="result__a" href="//duckduckgo.com/l/?uddg=<ENCODED_URL>">Title</a>
  //   <a class="result__snippet">Snippet text</a>
  // We extract the uddg= parameter which contains the real URL.

  const linkRegex =
    /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex =
    /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const links: { url: string; title: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    const titleHtml = match[2].replace(/<[^>]+>/g, "").trim();
    // Decode the uddg= parameter
    let realUrl = rawUrl;
    try {
      if (rawUrl.includes("uddg=")) {
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          realUrl = decodeURIComponent(uddgMatch[1]);
        }
      } else if (rawUrl.startsWith("//")) {
        realUrl = "https:" + rawUrl;
      } else if (rawUrl.startsWith("/")) {
        continue; // internal DDG link, skip
      }
    } catch {
      continue;
    }
    if (realUrl && !realUrl.includes("duckduckgo.com")) {
      links.push({ url: realUrl, title: titleHtml || realUrl });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    const snippetText = match[1].replace(/<[^>]+>/g, "").trim();
    snippets.push(snippetText);
  }

  const max = Math.min(num, 30, links.length);
  for (let i = 0; i < max; i++) {
    results.push({
      url: links[i].url,
      name: links[i].title,
      snippet: snippets[i] || "",
      host_name: safeHost(links[i].url),
      rank: i + 1,
      date: "",
      favicon: "",
    });
  }

  return results;
}

// ---------- Fallback chain orchestrator ----------

// Returns the ordered list of retrievers to try, given the primary choice.
function getRetrieverChain(primary: RetrieverType): RetrieverType[] {
  const all: RetrieverType[] = ["tavily", "zai", "duckduckgo"];
  // Primary first, then the others in their canonical order.
  const chain: RetrieverType[] = [primary];
  for (const r of all) {
    if (r !== primary) chain.push(r);
  }
  // Filter out tavily if no key configured.
  return chain.filter((r) => {
    if (r === "tavily" && !env("TAVILY_API_KEY")) return false;
    return true;
  });
}

export async function searchWeb(
  query: string,
  num: number,
  retriever: RetrieverType
): Promise<SearchResultItem[]> {
  const useFallback = isFallbackEnabled();
  const chain = useFallback
    ? getRetrieverChain(retriever)
    : [retriever];

  let lastErr: unknown;
  const tried: string[] = [];

  for (let i = 0; i < chain.length; i++) {
    const engine = chain[i];
    tried.push(engine);
    try {
      let results: SearchResultItem[] = [];
      if (engine === "tavily") {
        results = await tavilySearch(query, num);
      } else if (engine === "duckduckgo") {
        results = await duckduckgoSearch(query, num);
      } else {
        results = await zaiSearch(query, num);
      }

      // Success — log if we fell back from the primary.
      if (i > 0) {
        console.log(
          `[retriever] Fallback: "${engine}" succeeded with ${results.length} results after ${tried.slice(0, i).join(", ")} failed.`
        );
      }
      return results;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[retriever] Engine "${engine}" failed: ${msg.slice(0, 120)}${i < chain.length - 1 ? " → next engine" : " (no more engines)"}`
      );
      // No delay between engines — we want speed. The next engine is tried instantly.
    }
  }

  // All engines failed.
  const msg =
    lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `All ${tried.length} search engines failed. Tried: ${tried.join(" → ")}. Last error: ${msg}`
  );
}

// Export the individual search functions for testing / direct use.
export { tavilySearch, zaiSearch, duckduckgoSearch };
