// Critical-thinking prompts — appended to research-type responses to
// nudge the reader toward intellectual humility.
//
// Quaesitor's mission is "the seeker, the investigator" — research is
// not just answer-extraction, it's a habit of inquiry. Surfacing a
// single, varied critical-thinking question after each research report
// keeps that habit visible without being preachy.
//
// Constraints (per task spec):
//   - Only shown for research-type cards (not every chat message).
//   - One prompt per report (random selection from the pool below).
//   - Rendered subtly (warm, italic, muted text-[#6b6358], Lightbulb icon).
//
// The pool is deliberately short (6 prompts) so users see repetition
// only after ~6 reports — enough to feel varied, not so long that the
// prompts feel like filler. Add to the pool with care: each prompt
// must be answerable as a follow-up *to Quaesitor itself* (so the user
// can paste it back into the input bar).

export type CriticalThinkingMessageType = "research" | "chat" | "quick";

/**
 * The canonical prompt pool. Order is stable — the selection is random
 * via `Math.random()`, not via a counter, so two users seeing their
 * first report at the same time can get different prompts.
 */
export const CRITICAL_THINKING_PROMPTS: readonly string[] = [
  "What evidence would change this conclusion?",
  "What perspectives might be missing from this analysis?",
  "What are the strongest counterarguments to this view?",
  "What assumptions underlie this reasoning?",
  "How might this conclusion differ in another cultural context?",
  "What's the quality of the evidence cited?",
] as const;

/**
 * Returns a single random critical-thinking prompt.
 * Safe to call on the client (uses Math.random — not crypto-secure, but
 * no security relevance here).
 */
export function getCriticalThinkingPrompt(): string {
  const idx = Math.floor(Math.random() * CRITICAL_THINKING_PROMPTS.length);
  return CRITICAL_THINKING_PROMPTS[idx]!;
}

/**
 * Decides whether a critical-thinking prompt should be shown for a
 * given message type. Per the task spec: only research reports.
 *
 * Chat and quick cards are intentionally excluded — those are short
 * conversational turns where a Socratic nudge would feel preachy.
 */
export function shouldShowCriticalThinkingPrompt(
  messageType: CriticalThinkingMessageType
): boolean {
  return messageType === "research";
}
