// Citation verification — checks that URLs cited in the LLM-generated report
// actually exist in the collected sources AND that the cited text is supported
// by the source content.
//
// This prevents hallucinated citations: the LLM sometimes invents URLs or
// attributes claims to sources that don't contain the relevant text.
//
// Three verification levels:
//   verified   — URL is in job.sources AND the cited text appears (fuzzy match)
//   unverified — URL is in sources but cited text not found, OR URL not in sources
//   contradicts — URL is in sources AND the source text contains the key terms
//                 of the claim BUT with a nearby negation marker (e.g. "not",
//                 "false", "denies", "refutes"). Detected by `detectContradiction`,
//                 a simplified NLI check using keyword overlap + negation words.
//                 Not full NLI — it catches obvious contradictions but will miss
//                 paraphrased or antonym-based contradictions.
//
// P1 enhancement: an LLM-backed NLI verifier (`verifyWithNLI`) is available
// via the async `verifyCitationWithNLI` / `verifyAllCitationsWithNLI`
// wrappers. It uses the fast LLM to classify the claim-source relationship
// as "supports" | "contradicts" | "irrelevant" with full paraphrase
// understanding. The result is surfaced as `nliVerdict` on the
// `CitationCheck` and cached for 7 days (TTL) keyed by
// `nli:${sha256(claim+source)}`.
//
// The NLI pass is gated behind `NLI_VERIFIER_ENABLED === "true"` — it is
// OFF by default so the test suite (which exercises the sync `verifyCitation`)
// never makes real LLM calls. Production deployments that want the deeper
// NLI check set the env var; the sync path remains the fallback.

import * as crypto from "crypto";
import { logger } from "./logger";

export interface Source {
  url: string;
  title: string;
  excerpt?: string;
  text?: string; // full page text (if available)
}

export interface CitationCheck {
  url: string;
  citedText: string; // the text the LLM attributed to this URL
  foundInSources: boolean; // URL exists in job.sources?
  supportsClaim: "verified" | "unverified" | "contradicts";
  sourceExcerpt?: string; // the matching excerpt from the source
  sourceTitle?: string;
  /**
   * Optional human-readable warning surfaced when the verifier detects a
   * likely contradiction. Only populated when `supportsClaim === "contradicts"`.
   */
  warning?: string;
  /**
   * P1 enhancement: the LLM-backed NLI verdict on the claim/source
   * relationship. Only populated when:
   *   - the async `verifyCitationWithNLI` / `verifyAllCitationsWithNLI`
   *     wrappers are used (the sync `verifyCitation` does NOT call the LLM),
   *   - AND `NLI_VERIFIER_ENABLED === "true"` in the environment,
   *   - AND the source has text content to verify against.
   *
   * One of "supports" | "contradicts" | "irrelevant". When the LLM call
   * fails (network, auth, parse), the field is set to "irrelevant" (fail
   * safe — we never want a broken LLM to upgrade a citation to "supports").
   */
  nliVerdict?: "supports" | "contradicts" | "irrelevant";
}

export interface VerificationReport {
  total: number;
  verified: number;
  unverified: number;
  contradicts: number;
  details: CitationCheck[];
  /**
   * Aggregate list of warnings across all citations (currently: one entry
   * per contradicted citation). Empty when no contradictions are detected.
   * Introduced by the contradiction-detection pass — older callers can
   * safely ignore this field.
   */
  warnings: string[];
}

// ---------- Citation extraction ----------

/**
 * Extract all citation URLs from a markdown report.
 * Handles two formats:
 *   1. Inline links: [text](https://example.com)
 *   2. Reference-style: [1] with a Sources section listing [1]: https://...
 * Also extracts plain URLs in "Sources" sections.
 */
export function extractCitations(report: string): { url: string; citedText: string }[] {
  const citations: { url: string; citedText: string }[] = [];
  const seen = new Set<string>();

  // 1. Inline links: [cited text](url)
  const inlinePattern = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = inlinePattern.exec(report)) !== null) {
    const citedText = match[1]!.trim();
    const url = match[2]!.trim();
    if (!seen.has(url)) {
      seen.add(url);
      citations.push({ url, citedText });
    }
  }

  // 2. Reference-style: [N] in text, [N]: url in Sources section
  // First, find all reference definitions: [1]: https://...
  const refDefPattern = /^\[(\d+)\]:\s*(https?:\/\/[^\s]+)/gm;
  const refUrls = new Map<string, string>();
  while ((match = refDefPattern.exec(report)) !== null) {
    refUrls.set(match[1]!, match[2]!.trim());
  }

  // Then, find all [N] references in the text (not in the Sources section)
  // and map them to URLs.
  if (refUrls.size > 0) {
    // Split report into body + sources section
    const sourcesIdx = report.search(/^#+\s*Sources/im);
    const body = sourcesIdx >= 0 ? report.slice(0, sourcesIdx) : report;

    const refPattern = /\[(\d+)\]/g;
    let refMatch: RegExpExecArray | null;
    while ((refMatch = refPattern.exec(body)) !== null) {
      const refNum = refMatch[1]!;
      const url = refUrls.get(refNum);
      if (url && !seen.has(url)) {
        seen.add(url);
        // Try to get the sentence containing this reference
        const before = body.slice(0, refMatch.index);
        const sentenceStart = Math.max(
          before.lastIndexOf(". "),
          before.lastIndexOf("\n"),
          0
        );
        const sentenceEnd = body.indexOf(".", refMatch.index);
        const citedText =
          sentenceEnd >= 0
            ? body.slice(sentenceStart, sentenceEnd + 1).trim()
            : before.slice(sentenceStart).trim();
        citations.push({ url, citedText });
      }
    }
  }

  // 3. Plain URLs in Sources section (e.g. "— github.com https://...")
  const plainUrlPattern = /(https?:\/\/[^\s)\]]+)/g;
  while ((match = plainUrlPattern.exec(report)) !== null) {
    const url = match[1]!.trim();
    if (!seen.has(url)) {
      seen.add(url);
      citations.push({ url, citedText: "" });
    }
  }

  return citations;
}

// ---------- Text matching (fuzzy) ----------

/**
 * Check if the cited text is supported by the source content.
 * Uses a sliding-window approach: splits the cited text into key phrases
 * and checks if enough of them appear in the source text.
 */
function isTextSupported(citedText: string, sourceText: string): { supported: boolean; excerpt?: string } {
  if (!citedText || citedText.length < 10) {
    // No specific claim to verify — just URL presence is enough.
    return { supported: true, excerpt: sourceText.slice(0, 200) };
  }

  const source = sourceText.toLowerCase();
  const cited = citedText.toLowerCase();

  // Extract key phrases (3+ word sequences) from the cited text.
  const words = cited.split(/\s+/).filter((w) => w.length > 2);
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(" ");
    if (phrase.length > 10) phrases.push(phrase);
  }

  if (phrases.length === 0) {
    // Fallback: check if any significant word from cited text is in source.
    const significantWords = words.filter((w) => w.length > 4);
    const matches = significantWords.filter((w) => source.includes(w));
    return {
      supported: matches.length >= Math.ceil(significantWords.length * 0.3),
      excerpt: sourceText.slice(0, 200),
    };
  }

  // Count how many phrases appear in the source text.
  const matchedPhrases = phrases.filter((p) => source.includes(p));
  const matchRatio = matchedPhrases.length / phrases.length;

  // 30% phrase match = verified (fuzzy — the LLM paraphrases).
  if (matchRatio >= 0.3) {
    // Find the best matching excerpt.
    const bestPhrase = matchedPhrases[0] || phrases[0]!;
    const idx = source.indexOf(bestPhrase.toLowerCase());
    const start = Math.max(0, idx - 100);
    const end = Math.min(sourceText.length, idx + 300);
    return {
      supported: true,
      excerpt: sourceText.slice(start, end).trim(),
    };
  }

  return { supported: false };
}

// ---------- Contradiction detection (simplified NLI) ----------

// Common English negation markers. When one of these appears within a
// small word window of a claim's key term in the source text, we flag a
// likely contradiction. This is a deliberate simplification — it catches
// "X is not Y" / "X denies Y" / "X is false" style contradictions but
// will miss antonym-based ("X is closed" vs source "X is open") and
// paraphrased contradictions. A full NLI model would be needed for those.
const NEGATION_WORDS = [
  "not",
  "no",
  "never",
  "none",
  "nobody",
  "nothing",
  "neither",
  "nor",
  "cannot",
  "cant",
  "wont",
  "isnt",
  "wasnt",
  "arent",
  "werent",
  "doesnt",
  "didnt",
  "dont",
  "hasnt",
  "havent",
  "hadnt",
  "wouldnt",
  "shouldnt",
  "couldnt",
  "denies",
  "denied",
  "denying",
  "refutes",
  "refuted",
  "refuting",
  "disputes",
  "disputed",
  "disputing",
  "false",
  "incorrect",
  "wrong",
  "untrue",
  "fabricated",
  "debunk",
  "debunked",
  "debunking",
  "retract",
  "retracted",
  "retracts",
  "retraction",
  "rejection",
  "rejected",
  "rejects",
];

// English stopword list — used to filter the claim's word list down to
// meaningful content words before looking them up in the source.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to",
  "for", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "should", "could", "may", "might", "must", "can", "this", "that",
  "these", "those", "it", "its", "as", "if", "then", "than", "so",
  "such", "also", "very", "more", "most", "much", "many", "some", "any",
  "all", "both", "each", "few", "other", "which", "who", "whom", "whose",
  "what", "where", "when", "why", "how", "about", "into", "over",
  "after", "before", "between", "under", "above", "below", "up", "down",
  "out", "off", "through", "during", "while", "since", "until",
]);

/**
 * Detect whether `sourceContent` contradicts `claim`. This is a
 * simplified Natural Language Inference check using keyword overlap and
 * negation detection — it is NOT a full NLI model. It catches obvious
 * contradictions ("X is not Y", "X is false", "X denies Y") but misses
 * paraphrased or antonym-based contradictions.
 *
 * Algorithm:
 *   1. Extract key terms from `claim` — content words (length >= 4) that
 *      are not English stopwords. Proper nouns and numbers are kept.
 *   2. Find each key term in `sourceContent` (case-insensitive).
 *   3. If NO key terms are found → "unclear" (the source doesn't address
 *      the claim at all).
 *   4. If a key term IS found, look at a +/- 5-word window around each
 *      occurrence and check whether any negation word appears in that
 *      window.
 *   5. If any negation word is found near any key term → "contradicts".
 *   6. If key terms are found without nearby negation → "supports"
 *      (low confidence — caller should treat as "unclear" since this
 *      function is only invoked when fuzzy match already failed).
 */
export function detectContradiction(
  claim: string,
  sourceContent: string
): { status: "supports" | "contradicts" | "unclear"; confidence: number; reason: string } {
  if (!claim || !sourceContent) {
    return { status: "unclear", confidence: 0, reason: "empty claim or source" };
  }

  // 1. Extract key terms from the claim.
  const claimWords = claim
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  // Deduplicate while preserving order.
  const keyTerms: string[] = [];
  for (const w of claimWords) {
    if (!keyTerms.includes(w)) keyTerms.push(w);
  }

  if (keyTerms.length === 0) {
    return { status: "unclear", confidence: 0, reason: "no extractable key terms in claim" };
  }

  const source = sourceContent.toLowerCase();
  const sourceTokens = source.split(/\s+/);

  // 2-3. Find each key term in source. Build a list of token positions
  //      where each key term occurs.
  let totalMatches = 0;
  let negationMatches = 0;
  const reasons: string[] = [];

  for (const term of keyTerms) {
    for (let i = 0; i < sourceTokens.length; i++) {
      // Match the term as a whole token (allowing trailing punctuation
      // already stripped by the regex above on the claim side; on the
      // source side we strip trailing punctuation here).
      const tok = sourceTokens[i]!.replace(/[^a-z0-9'-]/g, "");
      if (tok !== term) continue;

      totalMatches++;

      // 4. Look at +/- 5-word window around this position.
      const windowStart = Math.max(0, i - 5);
      const windowEnd = Math.min(sourceTokens.length, i + 6);
      const window = sourceTokens.slice(windowStart, windowEnd);

      // 5. Check for negation words in the window.
      const negationHit = window.find((w) => {
        const cleaned = w.replace(/[^a-z0-9'-]/g, "");
        return NEGATION_WORDS.includes(cleaned);
      });

      if (negationHit) {
        negationMatches++;
        reasons.push(`negation "${negationHit.replace(/[^a-z0-9'-]/g, "")}" near key term "${term}"`);
      }
    }
  }

  // 3. No key terms found in source → unclear.
  if (totalMatches === 0) {
    return {
      status: "unclear",
      confidence: 0.3,
      reason: `none of the ${keyTerms.length} key terms from the claim appear in the source`,
    };
  }

  // 5. Negation found near at least one key term → contradicts.
  if (negationMatches > 0) {
    return {
      status: "contradicts",
      // Higher confidence when more key terms have negation markers.
      confidence: Math.min(0.85, 0.5 + negationMatches * 0.1),
      reason: `source contains ${negationMatches} negation marker(s) near key terms: ${reasons.slice(0, 3).join("; ")}`,
    };
  }

  // 6. Key terms found without negation → supports (low confidence).
  return {
    status: "supports",
    confidence: 0.4,
    reason: `source contains ${totalMatches} key term(s) from the claim with no nearby negation markers (low-confidence support)`,
  };
}

// ---------- Verification ----------

/**
 * Verify a single citation against the collected sources.
 */
export function verifyCitation(
  url: string,
  citedText: string,
  sources: Source[]
): CitationCheck {
  // Normalize URL for comparison (strip trailing slash, lowercase).
  const normalizeUrl = (u: string) => u.replace(/\/$/, "").toLowerCase().trim();

  const normalizedCitationUrl = normalizeUrl(url);
  const source = sources.find((s) => normalizeUrl(s.url) === normalizedCitationUrl);

  if (!source) {
    return {
      url,
      citedText,
      foundInSources: false,
      supportsClaim: "unverified",
    };
  }

  // URL is in sources. Check if the cited text is supported by source content.
  const sourceText = source.text || source.excerpt || "";
  if (!sourceText) {
    // No source text available — can't verify claim, but URL exists.
    return {
      url,
      citedText,
      foundInSources: true,
      supportsClaim: "unverified",
      sourceTitle: source.title,
      sourceExcerpt: source.excerpt,
    };
  }

  const { supported, excerpt } = isTextSupported(citedText, sourceText);

  // Fuzzy match succeeded → verified. No need for contradiction check
  // (the cited text and source text overlap meaningfully).
  if (supported) {
    return {
      url,
      citedText,
      foundInSources: true,
      supportsClaim: "verified",
      sourceExcerpt: excerpt,
      sourceTitle: source.title,
    };
  }

  // Fuzzy match FAILED. Before reporting "unverified", run the
  // contradiction detector: if the source contains the claim's key
  // terms with a nearby negation marker, the source is actively
  // contradicting the claim — a stronger signal than "we couldn't
  // find the claim in the source". The detector is a simplified NLI
  // check (keyword overlap + negation words); see `detectContradiction`
  // above for its limitations.
  const contradiction = detectContradiction(citedText, sourceText);
  if (contradiction.status === "contradicts") {
    return {
      url,
      citedText,
      foundInSources: true,
      supportsClaim: "contradicts",
      sourceExcerpt: excerpt,
      sourceTitle: source.title,
      warning: `Possible contradiction: ${contradiction.reason} (confidence ${(contradiction.confidence * 100).toFixed(0)}%).`,
    };
  }

  // Default: cited text not found in source and no contradiction
  // detected → unverified.
  return {
    url,
    citedText,
    foundInSources: true,
    supportsClaim: "unverified",
    sourceExcerpt: excerpt,
    sourceTitle: source.title,
  };
}

/**
 * Verify all citations in a report against the collected sources.
 */
export function verifyAllCitations(
  report: string,
  sources: Source[]
): VerificationReport {
  const citations = extractCitations(report);
  const details = citations.map((c) =>
    verifyCitation(c.url, c.citedText, sources)
  );

  // Collect a warning string for every contradicted citation. Older
  // callers ignore `warnings`; UI surfaces that opt in can render them
  // as a banner above the verification table.
  const warnings: string[] = [];
  for (const d of details) {
    if (d.supportsClaim === "contradicts" && d.warning) {
      warnings.push(`${d.url}: ${d.warning}`);
    }
  }

  return {
    total: details.length,
    verified: details.filter((d) => d.supportsClaim === "verified").length,
    unverified: details.filter((d) => d.supportsClaim === "unverified").length,
    contradicts: details.filter((d) => d.supportsClaim === "contradicts").length,
    details,
    warnings,
  };
}

// ============================================================================
// P1 enhancement — LLM-backed NLI (Natural Language Inference) verifier.
// ============================================================================
//
// The sync `verifyCitation` above uses keyword overlap + negation detection.
// That catches obvious contradictions ("X is not Y") but misses paraphrased
// or antonym-based contradictions ("X is closed" vs source "X is open").
//
// The async wrappers below (`verifyCitationWithNLI`,
// `verifyAllCitationsWithNLI`) layer an LLM-based NLI pass on top: they
// ask the fast model to classify the claim/source relationship as
// "supports" | "contradicts" | "irrelevant" with full paraphrase
// understanding. The verdict is surfaced as `nliVerdict` on the
// `CitationCheck` (alongside, not replacing, the sync `supportsClaim`).
//
// Gating:
//   - `NLI_VERIFIER_ENABLED === "true"` must be set in the environment.
//     OFF by default — the test suite (which calls the sync `verifyCitation`)
//     must never make real LLM calls.
//   - When disabled, the async wrappers fall back to the sync path and
//     `nliVerdict` is left `undefined`.
//
// Caching:
//   - Results are cached in a `Map` keyed by `nli:${sha256(claim+source)}`.
//   - TTL is 7 days (citation/source content rarely changes; LLM calls
//     are expensive).
//   - The cache is process-local (in-memory). For multi-process
//     deployments, a shared cache (Redis) would be a future enhancement.
//   - The cache is bounded to 10_000 entries (LRU-ish eviction: when
//     full, we drop the oldest 25% before inserting). This prevents
//     unbounded memory growth in long-running processes.

const NLI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const NLI_CACHE_MAX_ENTRIES = 10_000;

interface NliCacheEntry {
  verdict: "supports" | "contradicts" | "irrelevant";
  expiresAt: number;
}

const nliCache = new Map<string, NliCacheEntry>();

/**
 * Check whether the NLI verifier is enabled. Exposed for tests so they
 * can assert the gating behavior without setting env vars directly.
 */
export function isNliVerifierEnabled(): boolean {
  return process.env.NLI_VERIFIER_ENABLED === "true";
}

/**
 * Hash a (claim, source) pair into a stable cache key. SHA-256 truncated
 * to 32 hex chars — collisions on 16^32 are astronomically unlikely for
 * realistic citation volumes.
 */
function nliCacheKey(claim: string, sourceText: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${claim}\n---\n${sourceText}`)
    .digest("hex");
  return `nli:${hash.slice(0, 32)}`;
}

/**
 * Look up a cached NLI verdict. Returns `undefined` on miss or expiry.
 * Side-effect: evicts the expired entry on a TTL miss (lazy eviction —
 * keeps the common path cheap).
 */
function nliCacheGet(key: string): NliCacheEntry | undefined {
  const entry = nliCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    nliCache.delete(key);
    return undefined;
  }
  return entry;
}

/**
 * Store an NLI verdict in the cache. When the cache is full, drop the
 * oldest 25% of entries before inserting (approximate LRU — we don't
 * track access order, just insertion order via Map iteration).
 */
function nliCacheSet(
  key: string,
  verdict: "supports" | "contradicts" | "irrelevant"
): void {
  if (nliCache.size >= NLI_CACHE_MAX_ENTRIES) {
    // Drop the oldest 25% — Map preserves insertion order, so the
    // first N/4 entries are the oldest. This is a coarse eviction
    // strategy but sufficient for a 10k-entry cache.
    const dropCount = Math.floor(NLI_CACHE_MAX_ENTRIES / 4);
    let dropped = 0;
    for (const k of nliCache.keys()) {
      nliCache.delete(k);
      dropped++;
      if (dropped >= dropCount) break;
    }
  }
  nliCache.set(key, {
    verdict,
    expiresAt: Date.now() + NLI_CACHE_TTL_MS,
  });
}

/**
 * Clear the NLI cache. Exposed for tests that want to assert on cache
 * behavior without re-running the LLM call.
 */
export function clearNliCache(): void {
  nliCache.clear();
}

const NLI_PROMPT = `You are a fact-checker. Given a CLAIM and a SOURCE TEXT, determine if the source text supports, contradicts, or is irrelevant to the claim.

Respond with EXACTLY one word:
- "supports" — the source text directly supports the claim
- "contradicts" — the source text contradicts the claim
- "irrelevant" — the source text is not relevant to the claim

Do not include any other text.`;

/**
 * Run the LLM-backed NLI classification on a (claim, sourceText) pair.
 *
 * Returns one of "supports" | "contradicts" | "irrelevant". The function
 * NEVER throws — on any failure (LLM unreachable, auth error, parse
 * failure, timeout), it returns "irrelevant" (fail safe: a broken LLM
 * must never upgrade a citation to "supports").
 *
 * The claim is truncated to 500 chars and the source text to 2000 chars
 * before being sent to the LLM — enough context for the model to make
 * a judgment, bounded enough to keep the token cost predictable.
 *
 * Caching: results are cached for 7 days keyed by `nli:${hash(claim+source)}`.
 * A cache hit does NOT call the LLM.
 */
async function verifyWithNLI(
  claim: string,
  sourceText: string
): Promise<"supports" | "contradicts" | "irrelevant"> {
  // Fast path: empty inputs are "irrelevant" by definition.
  if (!claim || !sourceText) return "irrelevant";

  // Cache lookup BEFORE the dynamic import — a cache hit avoids both
  // the LLM call AND the cost of importing the llm-provider module.
  const cacheKey = nliCacheKey(claim, sourceText);
  const cached = nliCacheGet(cacheKey);
  if (cached) return cached.verdict;

  try {
    // Dynamic import so the test suite (which imports this file for
    // the sync `verifyCitation`) doesn't pull the full LLM provider
    // graph into the test bundle. The import is only evaluated when
    // NLI is actually invoked.
    const { getLLM } = await import("./llm-provider");
    const llm = await getLLM();
    const result = await llm.fast({
      messages: [
        { role: "system", content: NLI_PROMPT },
        {
          role: "user",
          content: `CLAIM: ${claim.slice(0, 500)}\n\nSOURCE TEXT: ${sourceText.slice(0, 2000)}\n\nVerdict:`,
        },
      ],
      // Low temperature — we want a deterministic classification, not
      // creative text generation. The model is asked for one word; a
      // higher temperature would risk "Sure! The answer is: supports"
      // which our parser would still handle but adds noise.
      temperature: 0,
      maxTokens: 10,
    });
    const verdict = result.content.trim().toLowerCase();
    let parsed: "supports" | "contradicts" | "irrelevant";
    if (verdict.includes("support")) {
      parsed = "supports";
    } else if (verdict.includes("contradict")) {
      parsed = "contradicts";
    } else {
      parsed = "irrelevant";
    }
    nliCacheSet(cacheKey, parsed);
    return parsed;
  } catch (err) {
    // Fail safe: a broken LLM never upgrades a citation to "supports".
    // The error is logged at debug level (not warn/error) because NLI
    // is an enhancement, not a critical path — operators running
    // without an LLM key configured shouldn't see a flood of warnings.
    logger.debug(
      {
        module: "citation-verifier",
        err: err instanceof Error ? err.message : String(err),
      },
      "NLI verifier LLM call failed — returning 'irrelevant' (fail safe)"
    );
    return "irrelevant";
  }
}

/**
 * Async wrapper around `verifyCitation` that adds an LLM-backed NLI
 * verdict on top of the sync verification.
 *
 * When `NLI_VERIFIER_ENABLED === "true"` and the source has text
 * content, this calls `verifyWithNLI` and attaches the verdict as
 * `nliVerdict` on the returned `CitationCheck`. The sync
 * `supportsClaim` field is unchanged — NLI is additive, not a
 * replacement.
 *
 * When NLI is disabled (the default), this is equivalent to
 * `verifyCitation` — same return value, just wrapped in a Promise.
 * No LLM call is made.
 *
 * Use this in routes that can `await` (research-engine, deep-research).
 * Sync callers (test suite, eval runner) should keep using
 * `verifyCitation` directly.
 */
export async function verifyCitationWithNLI(
  url: string,
  citedText: string,
  sources: Source[]
): Promise<CitationCheck> {
  const base = verifyCitation(url, citedText, sources);

  // Gate: NLI is opt-in via env var. When disabled, return the sync
  // result unchanged (no LLM call, no nliVerdict field).
  if (!isNliVerifierEnabled()) return base;

  // Gate: NLI only adds value when the source has text content. If the
  // source is URL-only (no excerpt/text), the LLM has nothing to
  // reason about — skip the call.
  const normalizeUrl = (u: string) =>
    u.replace(/\/$/, "").toLowerCase().trim();
  const normalizedCitationUrl = normalizeUrl(url);
  const source = sources.find(
    (s) => normalizeUrl(s.url) === normalizedCitationUrl
  );
  const sourceText = source?.text || source?.excerpt || "";
  if (!sourceText) return base;

  // Run NLI. The verdict is cached (7-day TTL) so repeat calls on the
  // same (claim, source) pair are free.
  const nliVerdict = await verifyWithNLI(citedText, sourceText);
  return { ...base, nliVerdict };
}

/**
 * Async wrapper around `verifyAllCitations` that adds LLM-backed NLI
 * verdicts to each citation in the report.
 *
 * When NLI is disabled, this is equivalent to `verifyAllCitations`.
 * When enabled, each `CitationCheck` in `details` gets an `nliVerdict`
 * field populated (when the source has text). The aggregate counts
 * (`verified`, `unverified`, `contradicts`) are based on the sync
 * `supportsClaim` and are NOT changed by NLI — NLI is additive signal
 * surfaced per-citation, not a replacement for the sync classification.
 *
 * The NLI calls are run concurrently (`Promise.all`) — for a report
 * with 20 citations, this is 20 parallel fast-LLM calls (cached after
 * the first run). The cache makes repeat verification of the same
 * report essentially free.
 */
export async function verifyAllCitationsWithNLI(
  report: string,
  sources: Source[]
): Promise<VerificationReport> {
  // Fast path: NLI disabled → just call the sync version.
  if (!isNliVerifierEnabled()) {
    return verifyAllCitations(report, sources);
  }

  const citations = extractCitations(report);
  const details = await Promise.all(
    citations.map((c) => verifyCitationWithNLI(c.url, c.citedText, sources))
  );

  const warnings: string[] = [];
  for (const d of details) {
    if (d.supportsClaim === "contradicts" && d.warning) {
      warnings.push(`${d.url}: ${d.warning}`);
    }
  }

  return {
    total: details.length,
    verified: details.filter((d) => d.supportsClaim === "verified").length,
    unverified: details.filter((d) => d.supportsClaim === "unverified").length,
    contradicts: details.filter((d) => d.supportsClaim === "contradicts").length,
    details,
    warnings,
  };
}
