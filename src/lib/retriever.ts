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
import { env, envBool } from "./env";

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
  num: number,
  retries = 1
): Promise<SearchResultItem[]> {
  // Try the HTML scraping first (better results when it works), then fall
  // back to the JSON Instant Answer API (limited but no CAPTCHA).
  const htmlResults = await duckduckgoHtmlSearch(query, num, retries);
  if (htmlResults.length > 0) return htmlResults;

  // HTML scraping returned 0 (CAPTCHA or structure change) — try JSON API.
  return duckduckgoJsonSearch(query, num);
}

// DuckDuckGo HTML scraping — returns real web URLs but may be blocked by CAPTCHA.
async function duckduckgoHtmlSearch(
  query: string,
  num: number,
  retries = 1
): Promise<SearchResultItem[]> {
  const url = "https://html.duckduckgo.com/html/";
  const body = new URLSearchParams({
    q: query,
    kp: "-2",
    kl: "us-en",
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) throw new Error(`DDG HTML failed (${res.status})`);

      const html = await res.text();

      // Detect CAPTCHA / anomaly page (DDG blocks bots with an "anomaly modal").
      if (html.includes("anomaly-modal") || html.includes("anomaly_modal")) {
        throw new Error("DDG returned CAPTCHA/anomaly page");
      }

      const results: SearchResultItem[] = [];
      const linkRegex =
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      const snippetRegex =
        /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

      const links: { url: string; title: string }[] = [];
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null) {
        const rawUrl = match[1];
        const titleHtml = match[2].replace(/<[^>]+>/g, "").trim();
        let realUrl = rawUrl;
        try {
          if (rawUrl.includes("uddg=")) {
            const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
            if (uddgMatch) realUrl = decodeURIComponent(uddgMatch[1]);
          } else if (rawUrl.startsWith("//")) {
            realUrl = "https:" + rawUrl;
          } else if (rawUrl.startsWith("/")) {
            continue;
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
        snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
      }

      const max = Math.min(num, 30, links.length);
      for (let i = 0; i < max; i++) {
        results.push({
          url: links[i]!.url,
          name: links[i]!.title,
          snippet: snippets[i] || "",
          host_name: safeHost(links[i]!.url),
          rank: i + 1,
          date: "",
          favicon: "",
        });
      }
      return results;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(1500);
        continue;
      }
    }
  }
  // Return empty (not throw) so the caller can try the JSON API fallback.
  return [];
}

// DuckDuckGo Instant Answer JSON API — limited results (mostly DDG internal
// pages), but no CAPTCHA. Used as a last resort when HTML scraping fails.
async function duckduckgoJsonSearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&kp=-2`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`DDG JSON API failed (${res.status})`);

  const data = (await res.json()) as {
    RelatedTopics?: Array<
      | { FirstURL?: string; Text?: string }
      | { Topics?: Array<{ FirstURL?: string; Text?: string }> }
    >;
    AbstractURL?: string;
    AbstractText?: string;
    Heading?: string;
  };

  const results: SearchResultItem[] = [];

  // Add the abstract if present.
  if (data.AbstractURL && data.AbstractText) {
    results.push({
      url: data.AbstractURL,
      name: data.Heading || data.AbstractText.slice(0, 80),
      snippet: data.AbstractText.slice(0, 300),
      host_name: safeHost(data.AbstractURL),
      rank: 1,
      date: "",
      favicon: "",
    });
  }

  // Flatten RelatedTopics (which can have nested Topics arrays).
  for (const topic of data.RelatedTopics || []) {
    if (results.length >= num) break;
    if ("FirstURL" in topic && topic.FirstURL) {
      results.push({
        url: topic.FirstURL,
        name: topic.Text?.slice(0, 120) || topic.FirstURL,
        snippet: topic.Text || "",
        host_name: safeHost(topic.FirstURL),
        rank: results.length + 1,
        date: "",
        favicon: "",
      });
    } else if ("Topics" in topic && Array.isArray(topic.Topics)) {
      for (const t of topic.Topics) {
        if (results.length >= num) break;
        if (t.FirstURL) {
          results.push({
            url: t.FirstURL,
            name: t.Text?.slice(0, 120) || t.FirstURL,
            snippet: t.Text || "",
            host_name: safeHost(t.FirstURL),
            rank: results.length + 1,
            date: "",
            favicon: "",
          });
        }
      }
    }
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
