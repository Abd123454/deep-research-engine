// Search engine — DuckDuckGo + Wikipedia (free, open, no API keys).
//
// DDG has multiple endpoints and aggressive bot detection. To maximize
// reliability without an API key, we try three DDG endpoints in order:
//   1. html.duckduckgo.com/html/  (HTML scraping, richest results)
//   2. lite.duckduckgo.com/lite/  (plain-text fallback, lower CAPTCHA rate)
//   3. api.duckduckgo.com/?format=json (Instant Answer API, sparse but stable)
//
// DDG's JSON API returns mostly internal duckduckgo.com links that are not
// readable articles. We filter those out. To guarantee usable results even
// when DDG is fully CAPTCHA'd, we ALWAYS supplement with the Wikipedia API
// (free, no key, rock-solid). Wikipedia returns real article URLs that
// Readability extracts cleanly.
//
// If everything fails, the caller surfaces an honest error.

import type { RetrieverType, SearchResultItem } from "./types";
import { envBool } from "./env";

export function getRetriever(): RetrieverType {
  return "duckduckgo";
}

function safeHost(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Rotate User-Agents to reduce CAPTCHA triggering.
const USER_AGENTS = [
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

// Convert a natural-language sub-question into search keywords.
// GitHub, Wikipedia, and DDG-JSON are keyword-based and return poor results
// for full sentences like "What is RISC-V instruction set architecture?".
// We strip question words, articles, and punctuation, keeping the topical
// terms. e.g. "What is RISC-V instruction set architecture?" -> "RISC-V instruction set architecture".
const STOP_WORDS = new Set([
  "what", "whats", "who", "whos", "when", "where", "why", "how",
  "is", "are", "was", "were", "be", "been", "being",
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "with",
  "and", "or", "but", "vs", "versus", "between", "among",
  "do", "does", "did", "can", "could", "should", "would", "will",
  "explain", "describe", "compare", "list", "give", "tell", "show",
  "key", "main", "major", "important", "different", "differences",
  "tradeoffs", "trade-off", "their",
]);

function toKeywords(query: string): string {
  // Remove punctuation, split on whitespace, drop stop words.
  const words = query
    .replace(/[?.,!;:'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1)
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  // If we stripped too much (e.g. all stop words), fall back to original
  // minus question mark.
  if (words.length < 2) {
    return query.replace(/[?]/g, "").trim();
  }
  return words.join(" ");
}

// Produce progressively shorter keyword queries for fallback.
// e.g. "RISC-V instruction set architecture" -> ["RISC-V instruction set architecture", "RISC-V instruction", "RISC-V"]
function progressiveKeywords(query: string): string[] {
  const base = toKeywords(query);
  const words = base.split(" ");
  if (words.length <= 2) return [base];
  const out = [base];
  // Step down to first 4, then 3, then 2 words.
  for (let n = Math.min(4, words.length - 1); n >= 2; n--) {
    out.push(words.slice(0, n).join(" "));
  }
  return out;
}

function looksLikeCaptcha(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("anomaly-modal") ||
    lower.includes("captcha") ||
    (lower.includes("ddg-") && lower.includes("blocked")) ||
    (html.length < 2000 && lower.includes("if you are not redirected"))
  );
}

// Filter out internal DDG links and other non-article URLs.
function isReadableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host.endsWith("duckduckgo.com")) return false;
    if (host.endsWith("google.com")) return false;
    if (host.endsWith("bing.com")) return false;
    if (host.endsWith("baidu.com")) return false;
    if (host.endsWith("yandex.com")) return false;
    return true;
  } catch {
    return false;
  }
}

// ---------- Endpoint 1: HTML scraping (richest results) ----------
async function ddgHtmlSearch(
  query: string,
  num: number,
  retries = 2
): Promise<SearchResultItem[]> {
  const url = "https://html.duckduckgo.com/html/";
  const body = new URLSearchParams({ q: query, kp: "-2", kl: "us-en" });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await sleep(1500 + Math.random() * 1500);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": randomUA(),
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://duckduckgo.com/",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) throw new Error(`DDG HTML ${res.status}`);
      const html = await res.text();
      if (looksLikeCaptcha(html)) throw new Error("DDG CAPTCHA (html)");

      return parseHtmlResults(html, num);
    } catch (err) {
      if (attempt < retries) continue;
      throw err;
    }
  }
  return [];
}

function parseHtmlResults(html: string, num: number): SearchResultItem[] {
  const results: SearchResultItem[] = [];
  const linkRegex = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
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
      } else if (rawUrl.startsWith("//")) realUrl = "https:" + rawUrl;
      else if (rawUrl.startsWith("/")) continue;
    } catch { continue; }
    if (realUrl && isReadableUrl(realUrl)) {
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
}

// ---------- Endpoint 2: lite.duckduckgo.com (plain text, lower CAPTCHA) ----------
async function ddgLiteSearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  const url = "https://lite.duckduckgo.com/lite/";
  const body = new URLSearchParams({
    q: query, kp: "-2", kl: "us-en", df: "", k1: "-1",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": randomUA(),
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://lite.duckduckgo.com/",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`DDG lite ${res.status}`);
  const html = await res.text();
  if (looksLikeCaptcha(html)) throw new Error("DDG CAPTCHA (lite)");

  const results: SearchResultItem[] = [];
  const linkRegex = /href="(https?:\/\/(?!duckduckgo\.com)[^"]+)"/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    if (isReadableUrl(match[1])) links.push(match[1]);
  }

  const snippetRegex = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
  }

  const max = Math.min(num, links.length);
  for (let i = 0; i < max; i++) {
    results.push({
      url: links[i]!,
      name: snippets[i]?.slice(0, 120) || links[i]!,
      snippet: snippets[i] || "",
      host_name: safeHost(links[i]!),
      rank: i + 1,
      date: "",
      favicon: "",
    });
  }
  return results;
}

// ---------- Endpoint 3: Instant Answer JSON API (sparse but stable) ----------
async function ddgJsonSearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&kp=-2`,
    {
      headers: { "User-Agent": randomUA() },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) throw new Error(`DDG JSON ${res.status}`);
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
  if (data.AbstractURL && data.AbstractText && isReadableUrl(data.AbstractURL)) {
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
  for (const topic of data.RelatedTopics || []) {
    if (results.length >= num) break;
    if ("FirstURL" in topic && topic.FirstURL && isReadableUrl(topic.FirstURL)) {
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
        if (t.FirstURL && isReadableUrl(t.FirstURL)) {
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

// ---------- Wikipedia API (free, no key, rock-solid supplement) ----------
// Always returns real article URLs that Readability extracts cleanly.
// Per Wikipedia's User-Agent policy, we send a descriptive UA with a
// contact URL. We retry once on 429 with backoff.
const WIKI_UA =
  "DeepResearchEngine/1.0 (https://github.com/Abd123454/deep-research-engine; self-hosted research tool)";

async function wikipediaSearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  // Use the opensearch API: returns [query, [titles], [descriptions], [urls]].
  const url =
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}` +
    `&limit=${num}&namespace=0&format=json&origin=*`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": WIKI_UA,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 429 && attempt === 0) {
        await sleep(2000);
        continue;
      }
      if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
      const data = (await res.json()) as [
        string,
        string[],
        string[],
        string[]
      ];
      const titles = data[1] || [];
      const descriptions = data[2] || [];
      const urls = data[3] || [];
      const results: SearchResultItem[] = [];
      for (let i = 0; i < titles.length && results.length < num; i++) {
        const u = urls[i];
        if (!u || !isReadableUrl(u)) continue;
        results.push({
          url: u,
          name: titles[i] || u,
          snippet: descriptions[i] || "",
          host_name: safeHost(u),
          rank: results.length + 1,
          date: "",
          favicon: "",
        });
      }
      return results;
    } catch (err) {
      if (attempt === 0) {
        await sleep(1500);
        continue;
      }
      throw err;
    }
  }
  return [];
}

// ---------- GitHub Search API (free, no key, returns fetchable URLs) ----------
// GitHub's REST search API allows 10 req/min unauthenticated. Returns
// github.com repo URLs that the page-reader can fetch directly (verified).
// Good for technical/software/architecture queries.
async function githubSearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  const url =
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}` +
    `&sort=stars&order=desc&per_page=${Math.min(num, 10)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "DeepResearchEngine/1.0 (self-hosted)",
      Accept: "application/vnd.github+json",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = (await res.json()) as {
    items?: Array<{
      html_url?: string;
      full_name?: string;
      description?: string;
    }>;
  };
  const results: SearchResultItem[] = [];
  for (const item of data.items || []) {
    if (results.length >= num) break;
    const u = item.html_url;
    if (!u || !isReadableUrl(u)) continue;
    results.push({
      url: u,
      name: item.full_name || u,
      snippet: item.description || "",
      host_name: safeHost(u),
      rank: results.length + 1,
      date: "",
      favicon: "",
    });
  }
  return results;
}

// ---------- Deduplication ----------
function dedupResults(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  const out: SearchResultItem[] = [];
  for (const item of items) {
    const key = item.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  // Re-rank.
  return out.map((it, i) => ({ ...it, rank: i + 1 }));
}

// ---------- Public: try DDG endpoints, always supplement with Wikipedia ----------

async function duckduckgoSearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  const errors: string[] = [];
  let ddgResults: SearchResultItem[] = [];

  // 1. HTML endpoint (richest).
  try {
    const r = await ddgHtmlSearch(query, num);
    if (r.length > 0) ddgResults = r;
    else errors.push("html: 0 results");
  } catch (err) {
    errors.push(`html: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. lite endpoint (lower CAPTCHA rate).
  if (ddgResults.length < num) {
    try {
      const r = await ddgLiteSearch(query, num);
      if (r.length > 0) ddgResults = [...ddgResults, ...r];
      else errors.push("lite: 0 results");
    } catch (err) {
      errors.push(`lite: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. JSON Instant Answer API (stable, sparse).
  if (ddgResults.length < num) {
    try {
      const r = await ddgJsonSearch(query, num);
      if (r.length > 0) ddgResults = [...ddgResults, ...r];
      else errors.push("json: 0 results");
    } catch (err) {
      errors.push(`json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. ALWAYS supplement with Wikipedia (free, no key, reliable).
  //    We use progressively shorter keyword queries because the Wikipedia
  //    opensearch API is keyword-based: a full sub-question returns 0, but
  //    the core topic (e.g. "RISC-V") returns the canonical article.
  let wikiResults: SearchResultItem[] = [];
  const wikiKws = progressiveKeywords(query);
  for (const kw of wikiKws) {
    if (wikiResults.length >= Math.ceil(num / 2)) break;
    try {
      const r = await wikipediaSearch(kw, num);
      if (r.length > 0) { wikiResults = [...wikiResults, ...r]; }
    } catch (err) {
      errors.push(`wiki(${kw}): ${err instanceof Error ? err.message : String(err)}`);
      break; // rate-limited or network — stop trying Wikipedia variants.
    }
  }

  // 5. ALWAYS supplement with GitHub (free, no key, fetchable URLs).
  //    GitHub repo pages extract cleanly via Readability and are never
  //    CAPTCHA'd. We use progressively shorter keyword queries so even
  //    niche sub-questions fall back to the core topic.
  let ghResults: SearchResultItem[] = [];
  const ghKws = progressiveKeywords(query);
  for (const kw of ghKws) {
    if (ghResults.length >= Math.min(num, 5)) break;
    try {
      const r = await githubSearch(kw, Math.min(num, 5));
      if (r.length > 0) { ghResults = [...ghResults, ...r]; }
    } catch (err) {
      errors.push(`github(${kw}): ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  // Combine: Wikipedia first (encyclopedic), then DDG (broad web),
  // then GitHub (technical), then dedup.
  const combined = dedupResults([...wikiResults, ...ddgResults, ...ghResults]).slice(0, num);

  if (envBool("DEBUG_SEARCH", false)) {
    console.log(
      `[search] "${query}": DDG=${ddgResults.length}, Wiki=${wikiResults.length}, ` +
        `GitHub=${ghResults.length}, combined=${combined.length}. ` +
        `Failures: ${errors.join(" | ") || "none"}`
    );
  }

  return combined;
}

export async function searchWeb(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  return duckduckgoSearch(query, num);
}

export { duckduckgoSearch, wikipediaSearch, githubSearch };
