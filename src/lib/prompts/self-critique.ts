// Self-Critique Prompt — P0-6 Constitutional Self-Critique Pass.
//
// After the research report is synthesized (and after the existing
// rewrite-style critique pass), a SECOND LLM call analyzes the report's
// factual claims and annotates each one with an inline marker:
//
//   [verified]     — the cited source directly supports the claim
//   [unverified]   — the source is cited but doesn't clearly support the claim
//   [contradicted] — the source contradicts the claim
//
// This pass is non-destructive: it must NOT remove content or add new claims,
// only insert markers after existing claims. The output is saved as the
// final user-facing report (subject to length-ratio guards in
// `selfCritiquePass` in research-engine.ts).
//
// The prompt is intentionally short and imperative. The sources are passed
// in the same user message (with their indexes matching the [N] citations
// in the report) so the model can map each citation to its source content
// without ambiguity.

export const SELF_CRITIQUE_PROMPT = `You are a fact-checker. Analyze the following research report.

For each factual claim in the report:
- If the cited source directly supports the claim, add "[verified]" after the claim
- If the source is cited but doesn't clearly support the claim, add "[unverified]"
- If the source contradicts the claim, add "[contradicted]"

Return the report with inline markers. Do not remove any content. Do not add new claims.

Report:
`;
