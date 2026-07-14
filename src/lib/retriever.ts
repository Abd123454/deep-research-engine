// search engine adapters — DuckDuckGo only (free, open, no key).

import type { RetrieverType, SearchResultItem } from "./types";
import { env, envBool } from "./env";

export function getRetriever(): RetrieverType {
  return "duckduckgo";
}

function safeHost(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// DuckDuckGo HTML scraping — real web URLs.
async function ddgHtmlSearch(query: string, num: number, retries = 2): Promise<SearchResultItem[]> {
  const url = "https://html.duckduckgo.com/html/";
  const body = new URLSearchParams({ q: query, kp: "-2", kl: "us-en" });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) throw new Error(`DDG HTML ${res.status}`);
      const html = await res.text();
      if (html.includes("anomaly-modal")) throw new Error("DDG CAPTCHA");

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
          url: links[i]!.url, name: links[i]!.title, snippet: snippets[i] || "",
          host_name: safeHost(links[i]!.url), rank: i + 1, date: "", favicon: "",
        });
      }
      return results;
    } catch (err) {
      if (attempt < retries) { await sleep(2000); continue; }
      throw err;
    }
  }
  return [];
}

// DDG JSON API — fallback when HTML scraping hits CAPTCHA.
async function ddgJsonSearch(query: string, num: number): Promise<SearchResultItem[]> {
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&kp=-2`,
    { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`DDG JSON ${res.status}`);
  const data = (await res.json()) as {
    RelatedTopics?: Array<{ FirstURL?: string; Text?: string } | { Topics?: Array<{ FirstURL?: string; Text?: string }> }>;
    AbstractURL?: string; AbstractText?: string; Heading?: string;
  };
  const results: SearchResultItem[] = [];
  if (data.AbstractURL && data.AbstractText) {
    results.push({ url: data.AbstractURL, name: data.Heading || data.AbstractText.slice(0, 80), snippet: data.AbstractText.slice(0, 300), host_name: safeHost(data.AbstractURL), rank: 1, date: "", favicon: "" });
  }
  for (const topic of data.RelatedTopics || []) {
    if (results.length >= num) break;
    if ("FirstURL" in topic && topic.FirstURL) {
      results.push({ url: topic.FirstURL, name: topic.Text?.slice(0, 120) || topic.FirstURL, snippet: topic.Text || "", host_name: safeHost(topic.FirstURL), rank: results.length + 1, date: "", favicon: "" });
    } else if ("Topics" in topic && Array.isArray(topic.Topics)) {
      for (const t of topic.Topics) {
        if (results.length >= num) break;
        if (t.FirstURL) results.push({ url: t.FirstURL, name: t.Text?.slice(0, 120) || t.FirstURL, snippet: t.Text || "", host_name: safeHost(t.FirstURL), rank: results.length + 1, date: "", favicon: "" });
      }
    }
  }
  return results;
}

async function duckduckgoSearch(query: string, num: number): Promise<SearchResultItem[]> {
  const html = await ddgHtmlSearch(query, num);
  if (html.length > 0) return html;
  return ddgJsonSearch(query, num);
}

export async function searchWeb(query: string, num: number): Promise<SearchResultItem[]> {
  return duckduckgoSearch(query, num);
}

export { duckduckgoSearch };
