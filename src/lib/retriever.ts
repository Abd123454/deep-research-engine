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
import { rankSourcesWithMinimum } from "./source-quality";

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
//
// GitHub, Wikipedia, and DDG-JSON are keyword-based. Full sentences return
// poor results, and naive "take the first N words" produces garbage like
// "History and development" (which matches the Mozilla Firefox article).
//
// We tokenize, score each token by topic-ness, drop stop words, and build
// the query from the highest-scoring tokens (preserving original order).
//
// Scoring (higher = more likely to be the topic):
//   5 — all-caps acronym (≥2 letters): ARM, ISA, CPU
//   5 — hyphenated or contains a digit: RISC-V, x86, COVID-19
//   4 — capitalized word NOT at sentence start (proper noun): Firefox, Berkeley
//   2 — other non-stopword
//   1 — generic content word: history, development, overview, applications
//   0 — stop word (dropped): the, of, and, vs, how, what...
//
// Example: "History and development of RISC-V instruction set architecture"
//   -> RISC-V(5) instruction(2) set(2) architecture(2) history(1) development(1)
//   -> top 5: "RISC-V instruction set architecture history"  (proper noun first)
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

// Generic content words that appear in sub-questions but rarely identify the
// topic. Kept (not dropped) but scored low so proper nouns outrank them.
const GENERIC_WORDS = new Set([
  "history", "development", "overview", "introduction", "background",
  "applications", "details", "aspects", "implications", "analysis",
  "comparison", "differences", "tradeoffs", "examples", "types",
  "features", "benefits", "challenges", "limitations", "advantages",
  "disadvantages", "pros", "cons", "use", "cases", "current", "state",
  "future", "trends", "market", "industry", "ecosystem", "community",
  "design", "principles", "concepts", "fundamentals", "basics",
  "guide", "tutorial", "review", "summary", "approach", "method",
]);

interface ScoredToken {
  word: string;
  score: number;
  index: number;
}

function scoreToken(word: string, index: number): number {
  const lower = word.toLowerCase();
  if (STOP_WORDS.has(lower)) return 0;
  // All-caps acronym (≥2 letters, not a single all-caps word like "I").
  if (word.length >= 2 && /^[A-Z][A-Z]+$/.test(word)) return 5;
  // Hyphenated or contains a digit: RISC-V, x86, C++, COVID-19.
  if (/[0-9]/.test(word) || (word.includes("-") && word.length > 1)) return 5;
  // Capitalized word NOT at sentence start → proper noun.
  if (/^[A-Z][a-z]/.test(word) && index > 0) return 4;
  // Generic content word.
  if (GENERIC_WORDS.has(lower)) return 1;
  return 2;
}

function tokenize(query: string): string[] {
  // Keep hyphens, digits, plus signs inside tokens. Split on whitespace and
  // sentence punctuation.
  return query
    .replace(/[?.,!;:'"()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1);
}

function toKeywords(query: string): string {
  const tokens = tokenize(query);
  if (tokens.length === 0) return query.replace(/[?]/g, "").trim();
  const scored: ScoredToken[] = tokens.map((w, i) => ({
    word: w,
    score: scoreToken(w, i),
    index: i,
  }));
  // Drop stop words (score 0).
  const kept = scored.filter((t) => t.score > 0);
  if (kept.length < 2) {
    // Fallback: return original minus punctuation.
    return tokens.join(" ");
  }
  // Take top 5 by score, then re-sort by original index to preserve order.
  const top = kept
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .sort((a, b) => a.index - b.index);
  return top.map((t) => t.word).join(" ");
}

// Produce a fallback query containing ONLY the high-signal tokens
// (proper nouns / acronyms / alphanumeric). Used when the full keyword
// query returns 0 results.
function toCoreTopic(query: string): string {
  const tokens = tokenize(query);
  const scored: ScoredToken[] = tokens.map((w, i) => ({
    word: w,
    score: scoreToken(w, i),
    index: i,
  }));
  const core = scored
    .filter((t) => t.score >= 4)
    .sort((a, b) => a.index - b.index)
    .map((t) => t.word);
  return core.length >= 1 ? core.join(" ") : toKeywords(query);
}

// Produce a single-token query from the FIRST high-signal token. Used as a
// last-resort fallback when multi-token queries return 0 (e.g. a sub-question
// comparing "RISC-V vs ARM vs x86" — no single article covers all three, but
// searching for "RISC-V" alone returns the canonical article).
function toPrimaryTopic(query: string): string {
  const tokens = tokenize(query);
  for (let i = 0; i < tokens.length; i++) {
    if (scoreToken(tokens[i]!, i) >= 4) {
      return tokens[i]!;
    }
  }
  return toKeywords(query).split(" ")[0] || query;
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

// ---------- Cancellation helper ----------
// Combines an optional user-provided abort signal (from the research job)
// with a timeout signal. If either fires, the fetch is aborted.
function withAbortSignal(userSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal | undefined {
  if (!userSignal) return AbortSignal.timeout(timeoutMs);
  // If the user already aborted, return an already-aborted signal.
  if (userSignal.aborted) return userSignal;
  // AbortSignal.any() is available in Node 20+ — combines multiple signals.
  // If not available, fall back to just the user signal (timeout is lost).
  if (typeof (AbortSignal as any).any === "function") {
    return (AbortSignal as any).any([userSignal, AbortSignal.timeout(timeoutMs)]);
  }
  return userSignal;
}

// ---------- Endpoint 1: HTML scraping (richest results) ----------
async function ddgHtmlSearch(
  query: string,
  num: number,
  retries = 2,
  userSignal?: AbortSignal
): Promise<SearchResultItem[]> {
  const url = "https://html.duckduckgo.com/html/";
  const body = new URLSearchParams({ q: query, kp: "-2", kl: "us-en" });

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Check for user cancellation before each attempt (including sleeps).
    if (userSignal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      if (attempt > 0) await sleep(1500 + Math.random() * 1500);
      // Re-check after sleep — user may have cancelled during the wait.
      if (userSignal?.aborted) throw new DOMException("Aborted", "AbortError");

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
        signal: withAbortSignal(userSignal, 12000),
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
  num: number,
  userSignal?: AbortSignal
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
    signal: withAbortSignal(userSignal, 12000),
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
  num: number,
  userSignal?: AbortSignal
): Promise<SearchResultItem[]> {
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&kp=-2`,
    {
      headers: { "User-Agent": randomUA() },
      signal: withAbortSignal(userSignal, 10000),
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
  "Quaesitor/1.0 (https://github.com/Abd123454/deep-research-engine; self-hosted research tool)";

async function wikipediaSearch(
  query: string,
  num: number,
  userSignal?: AbortSignal
): Promise<SearchResultItem[]> {
  // Use the opensearch API: returns [query, [titles], [descriptions], [urls]].
  const url =
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}` +
    `&limit=${num}&namespace=0&format=json&origin=*`;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (userSignal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": WIKI_UA,
          Accept: "application/json",
        },
        signal: withAbortSignal(userSignal, 10000),
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
  num: number,
  userSignal?: AbortSignal
): Promise<SearchResultItem[]> {
  const url =
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}` +
    `&sort=stars&order=desc&per_page=${Math.min(num, 10)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Quaesitor/1.0 (self-hosted)",
      Accept: "application/vnd.github+json",
    },
    signal: withAbortSignal(userSignal, 10000),
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
  num: number,
  userSignal?: AbortSignal
): Promise<SearchResultItem[]> {
  const errors: string[] = [];
  let ddgResults: SearchResultItem[] = [];

  // 1. HTML endpoint (richest).
  try {
    const r = await ddgHtmlSearch(query, num, 2, userSignal);
    if (r.length > 0) ddgResults = r;
    else errors.push("html: 0 results");
  } catch (err) {
    errors.push(`html: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. lite endpoint (lower CAPTCHA rate).
  if (ddgResults.length < num) {
    try {
      const r = await ddgLiteSearch(query, num, userSignal);
      if (r.length > 0) ddgResults = [...ddgResults, ...r];
      else errors.push("lite: 0 results");
    } catch (err) {
      errors.push(`lite: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. JSON Instant Answer API (stable, sparse).
  if (ddgResults.length < num) {
    try {
      const r = await ddgJsonSearch(query, num, userSignal);
      if (r.length > 0) ddgResults = [...ddgResults, ...r];
      else errors.push("json: 0 results");
    } catch (err) {
      errors.push(`json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. ALWAYS supplement with Wikipedia (free, no key, reliable article URLs).
  //    Wikipedia's opensearch API is keyword-based. We try up to three
  //    keyword variants in order of decreasing specificity:
  //      (a) full scored keywords: "RISC-V instruction set architecture history"
  //      (b) core topic (proper nouns only): "RISC-V"
  //      (c) primary topic (first proper noun): "RISC-V"
  //    This guarantees results even for comparison-style sub-questions like
  //    "RISC-V vs ARM vs x86" where no single article covers all terms.
  let wikiResults: SearchResultItem[] = [];
  const wikiPrimary = toKeywords(query);
  const wikiCore = toCoreTopic(query);
  const wikiSingle = toPrimaryTopic(query);
  const wikiKws = [wikiPrimary, wikiCore, wikiSingle];
  for (const kw of wikiKws) {
    if (wikiResults.length >= Math.ceil(num / 2)) break;
    // Skip duplicate keyword variants (e.g. core == single for simple queries).
    if (wikiResults.length > 0 && kw === wikiSingle && wikiCore === wikiSingle) break;
    try {
      const r = await wikipediaSearch(kw, num, userSignal);
      if (r.length > 0) wikiResults = [...wikiResults, ...r];
    } catch (err) {
      errors.push(`wiki(${kw}): ${err instanceof Error ? err.message : String(err)}`);
      break; // rate-limited or network — stop trying Wikipedia.
    }
  }

  // 5. ALWAYS supplement with GitHub (free, no key, fetchable repo URLs).
  //    GitHub's unauthenticated search API allows 10 req/min, so we make
  //    a SINGLE call. We use the primary topic (first proper noun) because
  //    GitHub search is strict and multi-term queries often return 0.
  let ghResults: SearchResultItem[] = [];
  try {
    ghResults = await githubSearch(toPrimaryTopic(query), Math.min(num, 5), userSignal);
  } catch (err) {
    errors.push(`github: ${err instanceof Error ? err.message : String(err)}`);
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
  num: number,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const raw = await duckduckgoSearch(query, num, signal);

  // Rank sources by quality (tier1 academic/gov first, tier3 last).
  // Weak sources (< 30 score) are dropped, with a minimum of 3 results
  // guaranteed to prevent source starvation on niche queries.
  const { ranked } = rankSourcesWithMinimum(
    raw.map((r) => ({ url: r.url, snippet: r.snippet })),
    Math.min(3, num)
  );

  // Map back to SearchResultItem, preserving the original data but
  // reordering by quality score.
  const result: SearchResultItem[] = [];
  for (const r of ranked) {
    const original = raw.find((s) => s.url === r.url);
    if (original) {
      result.push({ ...original, rank: result.length + 1 });
    }
  }

  if (envBool("DEBUG_SEARCH", false) && raw.length !== result.length) {
    console.log(
      `[search] Source quality: ${raw.length} raw → ${result.length} ranked ` +
        `(dropped ${raw.length - result.length} low-quality sources)`
    );
  }

  return result.slice(0, num);
}

export { duckduckgoSearch, wikipediaSearch, githubSearch };
