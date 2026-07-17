// Carbon footprint estimator for AI operations.
//
// Estimates CO₂ emissions from:
//   - LLM inference (token-generation energy × model size)
//   - Web search (network + indexing energy per query)
//   - Page reading (Playwright headless-browser energy per page loaded)
//
// Sources (public 2024 data, conservative mid-range estimates):
//   - LLM inference: ~2-4g CO₂ per query (varies by model size).
//     Per 1K tokens generated:
//       small  (≤7B params):  ~0.3g
//       medium (8B-70B):      ~0.6g
//       large  (>70B):        ~1.0g
//   - NVIDIA NIM (US data centers, 2024 PUE ~1.1): ~0.5-1g CO₂ per 1K tokens.
//   - Web search (DuckDuckGo): ~0.2g CO₂ per query.
//   - Page reading (Playwright): ~0.2g CO₂ per page loaded.
//
// When using Ollama (local inference on the user's own hardware), the LLM
// component drops to 0g CO₂ for the *remote* call — but the user's hardware
// still consumes electricity. We surface this as "0g CO₂ (local)" to indicate
// the remote carbon cost is zero; the local hardware carbon depends on the
// user's electricity source (see docs/ENVIRONMENTAL.md for renewable guidance).
//
// These are rough estimates intended for user awareness, not precise
// accounting. For rigorous carbon measurement, integrate with a service like
// Cloud Carbon Footprint or Green Algorithms.

export type CarbonModelSize = "small" | "medium" | "large";

export interface CarbonEstimate {
  /** Total estimated CO₂ in grams. */
  grams: number;
  /** Human-readable provenance note. */
  source: string;
  /** Breakdown by emission category. */
  breakdown: { category: string; grams: number }[];
  /**
   * True when the LLM ran locally (Ollama) and therefore has 0g REMOTE
   * CO₂. The UI uses this to render "0g CO₂ (local)".
   */
  local?: boolean;
}

// Token-rate lookup: grams of CO₂ per 1K tokens generated, by model size.
const TOKEN_RATE: Record<CarbonModelSize, number> = {
  small: 0.3,
  medium: 0.6,
  large: 1.0,
};

// Per-operation emissions (grams CO₂).
const SEARCH_EMISSIONS_PER_QUERY = 0.2;
const PAGE_EMISSIONS_PER_PAGE = 0.2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Estimate CO₂ for a deep research job.
 *
 * @param params.tokensGenerated - Output tokens across all LLM calls.
 * @param params.pagesRead      - Pages fetched via Playwright/HTTP.
 * @param params.searchQueries  - Web search API calls made.
 * @param params.modelSize      - LLM parameter bucket.
 * @param params.local          - True if LLM ran on local hardware (Ollama).
 */
export function estimateResearchCarbon(params: {
  tokensGenerated: number;
  pagesRead: number;
  searchQueries: number;
  modelSize: CarbonModelSize;
  local?: boolean;
}): CarbonEstimate {
  const { tokensGenerated, pagesRead, searchQueries, modelSize, local } = params;

  // LLM emissions drop to 0 when running locally (the remote API wasn't called).
  // Local hardware still draws power, but that's outside this estimator's scope.
  const llmEmissions = local
    ? 0
    : (tokensGenerated / 1000) * TOKEN_RATE[modelSize];
  const searchEmissions = searchQueries * SEARCH_EMISSIONS_PER_QUERY;
  const pageEmissions = pagesRead * PAGE_EMISSIONS_PER_PAGE;
  const total = llmEmissions + searchEmissions + pageEmissions;

  return {
    grams: round2(total),
    source: local
      ? "Local inference (Ollama) — 0g remote CO₂. Estimated network/page-reading emissions only."
      : "Estimated based on public LLM energy data (2024)",
    local,
    breakdown: [
      { category: "LLM inference", grams: round2(llmEmissions) },
      { category: "Web search", grams: round2(searchEmissions) },
      { category: "Page reading", grams: round2(pageEmissions) },
    ],
  };
}

/**
 * Estimate CO₂ for a single chat turn.
 */
export function estimateChatCarbon(
  tokensGenerated: number,
  modelSize: CarbonModelSize,
  local = false
): CarbonEstimate {
  const llmEmissions = local
    ? 0
    : (tokensGenerated / 1000) * TOKEN_RATE[modelSize];
  return {
    grams: round2(llmEmissions),
    source: local
      ? "Local inference (Ollama) — 0g remote CO₂."
      : "Estimated based on public LLM energy data (2024)",
    local,
    breakdown: [{ category: "LLM inference", grams: round2(llmEmissions) }],
  };
}

/**
 * Format a carbon value for compact display.
 *   <1g    → "234mg CO₂"
 *   <1kg   → "2.3g CO₂"
 *   ≥1kg   → "1.23kg CO₂"
 */
export function formatCarbon(grams: number): string {
  if (grams < 1) return `${Math.round(grams * 1000)}mg CO₂`;
  if (grams < 1000) return `${grams.toFixed(1)}g CO₂`;
  return `${(grams / 1000).toFixed(2)}kg CO₂`;
}

/**
 * Infer the model-size bucket from a model identifier string.
 * Used so callers can pass a raw model name without pre-bucketing.
 *
 * Heuristics (best-effort — model names are inconsistent across providers):
 *   - Contains "70b" / "405b" / "large" / "xl" / "175b" → large
 *   - Contains "8b" / "13b" / "14b" / "32b" / "mini" / "small" → medium
 *   - Otherwise (e.g. "1b", "3b", "tiny") → small
 */
export function inferModelSize(model: string): CarbonModelSize {
  const m = model.toLowerCase();
  if (
    /(\b|_)(70|72b|104b|175b|405b|675b|large|xl|ultra)(\b|_)/.test(m) ||
    m.includes("70b") ||
    m.includes("405b") ||
    m.includes("675b")
  ) {
    return "large";
  }
  if (
    m.includes("8b") ||
    m.includes("13b") ||
    m.includes("14b") ||
    m.includes("32b") ||
    m.includes("mini") ||
    m.includes("small") ||
    m.includes("haiku")
  ) {
    return "medium";
  }
  return "small";
}
