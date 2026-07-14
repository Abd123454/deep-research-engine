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
//   contradicts — URL is in sources but the source text contradicts the claim
//                 (currently not implemented — requires NLI; marked as unverified)

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
}

export interface VerificationReport {
  total: number;
  verified: number;
  unverified: number;
  contradicts: number;
  details: CitationCheck[];
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

  return {
    url,
    citedText,
    foundInSources: true,
    supportsClaim: supported ? "verified" : "unverified",
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

  return {
    total: details.length,
    verified: details.filter((d) => d.supportsClaim === "verified").length,
    unverified: details.filter((d) => d.supportsClaim === "unverified").length,
    contradicts: details.filter((d) => d.supportsClaim === "contradicts").length,
    details,
  };
}
