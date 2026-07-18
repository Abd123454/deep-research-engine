# Work Record — Task add-3-features

## Task
Implement 3 high-impact P0 features from the audit:
1. **P0-6**: Constitutional self-critique pass (inline `[verified]` / `[unverified]` / `[contradicted]` markers on research reports)
2. **P0-7**: Cmd+K / Ctrl+K command palette (fuzzy-search commands with keyboard nav)
3. **P0-8**: Inline citation hover cards (interactive `[N]` popovers with source metadata + tier/verification badges)

## Status
✅ Complete — all 3 features shipped.

## Files Created
- `src/lib/prompts/self-critique.ts` — `SELF_CRITIQUE_PROMPT` constant (spec'd text + docblock).
- `src/components/CommandPalette.tsx` — Cmd+K palette (≈520 lines, fuzzy matcher, keyboard nav, portal rendering, Quaesitor styling).
- `src/components/CitationHoverCard.tsx` — `CitationHoverCard` + `CitationHoverCardInner` (private) + `parseCitations` helper (≈440 lines).

## Files Modified
- `src/lib/research-engine.ts` — added `selfCritiquePass()` function (with length-ratio / marker-count / heading-count guards); wired into `synthesizeReport` after the existing rewrite-critique + follow-up generation, before the bias disclaimer, wrapped in try/catch + Sentry.
- `src/components/UnifiedInterface.tsx` — added CommandPalette + Cmd+K listener + lifted `inputMode` state + lazy-loaded MemoryPanel.
- `src/components/input/UnifiedInput.tsx` — added optional controlled `mode` + `onModeChange` props (backward compatible).
- `src/components/cards/ChatCard.tsx` — added optional `sources` prop + `renderWithCitations` helper applied to p/h1-h3/li markdown renderers.
- `src/components/research/ReportViewer.tsx` — added optional `sources` + `verificationReport` props + `verificationMap` + `markdownComponents` with citation support.
- `src/components/cards/ResearchCard.tsx` — passed `job.sources` + `job.verificationReport` to ReportViewer.

## Validation
- `bunx tsc --noEmit --strict` → 0 errors
- `bun run lint` → 0 errors (6 pre-existing warnings, unchanged from baseline)
- `bun run test` → 447/447 tests pass across 33 test files (including the 24-test `research-engine-integration.test.ts` suite that exercises `synthesizeReport`)

## Key Design Decisions
1. **P0-6 guards**: The self-critique pass is non-destructive — length-ratio (0.9×–1.6×), marker-count (≥1), and heading-count (≥70% retained) guards ensure the LLM can't accidentally rewrite or truncate the report. The pass is also gated (500-char minimum, source-required) and wrapped in try/catch so failures fall back to the original report.
2. **P0-7 component split**: The `mode` state was lifted from `UnifiedInput` to `UnifiedInterface` so the palette can switch it. `UnifiedInput` accepts optional `mode` + `onModeChange` props (controlled-mode pattern), falling back to internal state when absent — backward compatible.
3. **P0-8 component split**: `CitationHoverCard` (outer, no hooks) handles the no-source fallback; `CitationHoverCardInner` (private, with hooks) renders the interactive popover. This satisfies the React hooks-order rule. The popover is portalled to `document.body` so it isn't clipped by parent `overflow: hidden` containers.
4. **P0-8 backward compat**: `ChatCard.sources` is optional — when absent (chat API doesn't send sources), `[N]` renders as plain text. `ReportViewer.sources` + `verificationReport` are optional. All existing callers continue to work.
5. **Streaming preserved**: The streaming path (job.reportStream tokens) is untouched — markers only appear in the saved job.report. ReportViewer's streaming branch uses `<pre>` (no ReactMarkdown), so hover cards only render once the final report is processed.

## See Also
- `/home/z/my-project/worklog.md` (appended section "Task add-3-features — 3 High-Impact P0 Features")
- `/home/z/my-project/DESIGN.md` (Quaesitor design system — color palette, typography, anti-patterns)
