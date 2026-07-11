// Retriever (search engine) adapters.
//
// Supports:
//   - "zai":       built-in Z.AI web_search (FREE, default)
//   - "tavily":    Tavily API (requires TAVILY_API_KEY)
//   - "duckduckgo": placeholder; falls back to Z.AI in this environment.

import ZAI from "z-ai-web-dev-sdk";
import type { RetrieverType, SearchResultItem } from "./types";

function env(key: string, fallback = ""): string {
  if (typeof process === "undefined") return fallback;
  return (process.env?.[key] ?? fallback).trim();
}

export function getRetriever(): RetrieverType {
  const v = env("RETRIEVER", "zai").toLowerCase() as RetrieverType;
  if (v === "tavily" && !env("TAVILY_API_KEY")) return "zai";
  return v;
}

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZAI() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

// ---------- Z.AI web_search ----------

async function zaiSearch(
  query: string,
  num: number
): Promise<SearchResultItem[]> {
  const zai = await getZAI();
  const results = await zai.functions.invoke("web_search", {
    query,
    num: Math.min(Math.max(num, 1), 30),
  });
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

export async function searchWeb(
  query: string,
  num: number,
  retriever: RetrieverType
): Promise<SearchResultItem[]> {
  switch (retriever) {
    case "tavily":
      return tavilySearch(query, num);
    case "duckduckgo":
    case "zai":
    default:
      return zaiSearch(query, num);
  }
}
