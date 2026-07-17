// Source Quality Scoring — ranks sources by domain tier and content signals.
//
// Tier 1 (90-100): Academic, government, established media
//   - .edu, .gov, .mil
//   - nature.com, science.org, ieee.org, arxiv.org
//   - reuters.com, bbc.com, nytimes.com
//   - wikipedia.org (trusted reference)
//   - Multi-cultural academic repositories:
//       CNKI (中国知网), Baidu Scholar, Chinese Academy of Sciences,
//       J-STAGE, CiNii (Japan), Al-Manhal (دار المنهل),
//       Dar Al-Mandumah, JSTOR Arabic
//   - Open-access aggregators:
//       DOAJ, OpenAlex, CORE, PubMed Central
//   - Regional news of record:
//       Al Jazeera English, South China Morning Post,
//       Nikkei Asia, The Wire (India)
//
// Tier 2 (60-89): Industry, reputable blogs, documentation
//   - github.com, stackoverflow.com, stackexchange.com
//   - developer.mozilla.org, w3.org
//   - medium.com, dev.to
//
// Tier 3 (30-59): General web, unknown quality
//   - Everything else
//
// Score adjustments:
//   +5  HTTPS
//   +5  Substantial snippet (>100 chars)
//   -20 Sponsored/advertisement indicators
//
// Sources scoring below 30 are dropped from results.
//
// The Tier 1 list is intentionally multi-cultural: a query about
// Chinese AI policy or Arabic literature should not be penalised just
// because the best sources publish in a non-Western language or under
// a non-Western domain. Each entry was selected because it is a
// peer-reviewed index, a national academy, or a long-standing news
// outlet of record in its region.

export type SourceTier = "tier1" | "tier2" | "tier3";

export interface SourceScore {
  url: string;
  score: number; // 0-100
  tier: SourceTier;
  reasons: string[];
}

export interface RankedSource {
  url: string;
  snippet?: string;
  score: number;
  tier: SourceTier;
  reasons: string[];
}

export interface DroppedSource {
  url: string;
  reason: string;
}

export interface RankResult {
  ranked: RankedSource[];
  dropped: DroppedSource[];
}

// ---------- Domain lists ----------

const TIER1_DOMAINS = [
  // Western reference
  "wikipedia.org",
  "nature.com",
  "science.org",
  "ieee.org",
  "arxiv.org",
  "reuters.com",
  "bbc.com",
  "bbc.co.uk",
  "nytimes.com",
  "pubmed.ncbi.nlm.nih.gov",
  "scholar.google.com",
  "dl.acm.org",
  "sciencedirect.com",
  "springer.com",
  "wiley.com",

  // ── Multi-cultural academic repositories ──────────────────────────
  // Arabic
  "manhal.com",           // Al-Manhal (دار المنهل) — Arabic e-books & journals
  "almanhal.com",
  "mandumah.com",         // Dar Al-Mandumah — Arabic peer-reviewed journals
  "search.mandumah.com",
  "jstor.org",            // JSTOR (Arabic + multilingual archive)
  // Chinese
  "cnki.net",             // 中国知网 — China National Knowledge Infrastructure
  "kns.cnki.net",
  "oversea.cnki.net",
  "xueshu.baidu.com",     // Baidu Scholar (百度学术)
  "cas.cn",               // Chinese Academy of Sciences (中国科学院)
  "english.cas.cn",
  // Japanese
  "jstage.jst.go.jp",     // J-STAGE — Japan's largest academic platform
  "ci.nii.ac.jp",         // CiNii — Japanese academic search

  // ── Open-access aggregators ────────────────────────────────────────
  "doaj.org",             // Directory of Open Access Journals
  "openalex.org",         // OpenAlex — open scholarly graph
  "core.ac.uk",           // CORE — open-access research papers
  "ncbi.nlm.nih.gov",     // PubMed Central host (NLH)
  "pmc.ncbi.nlm.nih.gov",

  // ── Regional news of record ────────────────────────────────────────
  "aljazeera.com",        // Al Jazeera English (Arabic + English)
  "scmp.com",             // South China Morning Post (Hong Kong)
  "asia.nikkei.com",      // Nikkei Asia (Japan)
  "nikkei.com",
  "thewire.in",           // The Wire (India)
  "thehindu.com",         // The Hindu — India newspaper of record
  "yonhapnews.co.kr",     // Yonhap News Agency — South Korea
  "haaretz.com",          // Haaretz — Israel / Middle East

  // ── Korean academic ───────────────────────────────────────────────
  "dbpia.co.kr",          // DBpia — Korean academic database
  "riss.kr",              // RISS — Research Information Sharing Service (Korea)
];

const TIER1_SUFFIXES = [".edu", ".gov", ".mil"];

const TIER2_DOMAINS = [
  "github.com",
  "stackoverflow.com",
  "stackexchange.com",
  "developer.mozilla.org",
  "w3.org",
  "medium.com",
  "dev.to",
  "khanacademy.org",
  "coursera.org",
  "edx.org",
];

// ---------- Helpers ----------

function extractHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

// ---------- Public API ----------

export function scoreSource(url: string, snippet?: string): SourceScore {
  const reasons: string[] = [];
  let score = 50; // default tier3
  let tier: SourceTier = "tier3";

  const host = extractHost(url);
  if (!host) {
    return { url, score: 0, tier: "tier3", reasons: ["invalid URL"] };
  }

  // Check tier 1 (exact domain match or suffix).
  const isTier1 =
    TIER1_DOMAINS.some((d) => matchesDomain(host, d)) ||
    TIER1_SUFFIXES.some((s) => host.endsWith(s));

  if (isTier1) {
    score = 95;
    tier = "tier1";
    reasons.push("trusted domain");
  } else if (TIER2_DOMAINS.some((d) => matchesDomain(host, d))) {
    score = 70;
    tier = "tier2";
    reasons.push("reputable domain");
  }

  // HTTPS bonus.
  if (url.startsWith("https://")) {
    score += 5;
    reasons.push("HTTPS");
  }

  // Substantial content bonus.
  if (snippet && snippet.length > 100) {
    score += 5;
    reasons.push("substantial content");
  }

  // Spam indicators penalty.
  if (snippet && /sponsored|advertisement|paid promotion/i.test(snippet)) {
    score -= 20;
    reasons.push("sponsored content");
  }

  // Clamp to 0-100.
  score = Math.max(0, Math.min(100, score));

  return { url, score, tier, reasons };
}

export function rankSources(
  sources: Array<{ url: string; snippet?: string }>
): RankResult {
  const scored = sources.map((s) => {
    const scoreResult = scoreSource(s.url, s.snippet);
    return {
      url: s.url,
      snippet: s.snippet,
      score: scoreResult.score,
      tier: scoreResult.tier,
      reasons: scoreResult.reasons,
    };
  });

  // Keep sources scoring >= 30, sorted by score descending.
  const ranked = scored
    .filter((s) => s.score >= 30)
    .sort((a, b) => b.score - a.score);

  const dropped = scored
    .filter((s) => s.score < 30)
    .map((s) => ({ url: s.url, reason: `low quality score: ${s.score}` }));

  return { ranked, dropped };
}

/**
 * Rank sources but guarantee a minimum number of results.
 * If fewer than `minResults` sources pass the threshold, include the
 * next-best dropped sources to reach the minimum. This prevents source
 * starvation on niche queries where all results are tier3.
 */
export function rankSourcesWithMinimum(
  sources: Array<{ url: string; snippet?: string }>,
  minResults: number = 3
): RankResult {
  const { ranked, dropped } = rankSources(sources);

  if (ranked.length >= minResults || dropped.length === 0) {
    return { ranked, dropped };
  }

  // Pull in the best dropped sources to reach the minimum.
  const needed = Math.min(minResults - ranked.length, dropped.length);
  const recovered = dropped.slice(0, needed).map((d) => {
    const scoreResult = scoreSource(d.url);
    return {
      url: d.url,
      score: scoreResult.score,
      tier: scoreResult.tier,
      reasons: [...scoreResult.reasons, "recovered (below threshold but needed)"],
    };
  });

  const remainingDropped = dropped.slice(needed);

  return {
    ranked: [...ranked, ...recovered].sort((a, b) => b.score - a.score),
    dropped: remainingDropped,
  };
}
