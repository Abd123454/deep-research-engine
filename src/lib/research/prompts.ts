// Quaesitor — Research engine prompt templates.
//
// Extracted from `src/lib/research-engine.ts` as part of the god-object
// refactoring pass (final-cleanup task). Centralizing the prompt-template
// strings here lets us audit / localize / version them in one place.
//
// This module currently exports the single standalone prompt-template
// constant that was defined inside `research-engine.ts`: `BIAS_DISCLAIMER`,
// appended to every research report by `appendBiasDisclaimer()`.
//
// The larger inline LLM-message templates (the `content: \`...\`` strings
// passed to `llm.smart({...})` in `generatePlan`, `decompose`,
// `extractFindings`, `analyzeGaps`, `synthesizeReport`, etc.) were NOT
// moved because they're tightly interleaved with runtime state (config,
// findings, sources) via template-literal interpolation. Moving them
// would require either template functions (changing the call sites) or
// splitting the static + dynamic parts (introducing two sources of
// truth per prompt). The audit explicitly allowed the MINIMUM split
// (extract standalone types + prompt constants only) when the full
// extraction was too risky — that's what we did.
//
// MOVE ONLY — the `BIAS_DISCLAIMER` string is byte-for-byte identical
// to the constant that was inline in `research-engine.ts`.

/**
 * Appended to EVERY research report regardless of source quality or
 * bias_auditor outcome. The disclaimer reminds readers that web-sourced
 * research inherits cultural, geographic, and linguistic biases from its
 * sources, and that Quaesitor's bias_auditor agent is a mitigation, not
 * a guarantee. Readers are urged to seek additional perspectives —
 * especially from underrepresented regions — before relying on the
 * report for consequential decisions.
 *
 * The disclaimer is added AFTER the self-critique pass so the LLM doesn't
 * "review" it (it would just delete it as redundant). It's appended to
 * `finalReport` only — the streamed tokens (job.reportStream) are the
 * LLM's raw output and don't include the disclaimer.
 *
 * Format: an array of lines joined with "\n" — prepended with "" so the
 * joined string starts with a newline (matches the original inline
 * definition exactly). `appendBiasDisclaimer()` does `report.trimEnd() +
 * "\n" + BIAS_DISCLAIMER` to insert a blank line before the divider.
 */
export const BIAS_DISCLAIMER = [
  "",
  "---",
  "",
  "⚠️ **Bias notice**: This report was generated from web sources that may reflect cultural, geographic, and linguistic biases. Quaesitor's `bias_auditor` agent has reviewed the output, but readers should critically evaluate sources and seek additional perspectives, especially from underrepresented regions.",
  "",
].join("\n");
