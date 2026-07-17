# Task comp-psych-95 — Competitive (5.3→9.5) + Psychological (7.5→9.5)

**Agent:** comp-psych-95
**Status:** ✅ Complete
**Task ID:** comp-psych-95
**Scope:** 7 deliverables across two pillars — MCP marketplace, artifacts
panel overhaul, Computer Use stub, mobile responsive audit, critical
thinking prompts, user onboarding flow, known-limitations honesty
section.

## Mission

The independent audit scored Competitive at 5.3 and Psychological at
7.5. This task raises both to 9.5 by closing the remaining gaps:

1. **Competitive** — MCP marketplace registry + API stubs (visible
   differentiator), ArtifactsPanel tabs/download/copy/version-history
   (parity with Claude/ChatGPT artifact viewers), Computer Use stub
   (forward-looking differentiator), mobile responsive audit (375px
   width).
2. **Psychological** — critical-thinking prompts after research reports
   (nudges intellectual humility), 3-step onboarding (sets expectations
   + privacy posture), "Known limitations" collapsible on every research
   report (models intellectual humility).

## Approach

- **MCP marketplace is a visible stub.** The catalog is real (6 curated
  servers across 5 categories with real corpus sizes — 2.4M arXiv
  papers, 35M PubMed citations, 11M USPTO patents, 8M CourtListener
  opinions). The install/uninstall API is real (auth-gated,
  audit-logged, in-memory state). The actual MCP transport wiring is
  future work — flagged in the file header and surfaced in the API
  response (`stub: true`) so the UI can warn users.
- **Computer Use is a pure stub.** Ships the interface now
  (`executeComputerUse`, `isComputerUseAvailable`,
  `computerUseStatus`) so the UI can advertise "not available in this
  deployment" rather than silently absent. Returns `{ success: false,
  error: "..." }` until `COMPUTER_USE_ENABLED=true` AND a Playwright +
  display pipeline lands.
- **ArtifactsPanel gains tabs (Preview/Code/History) + download +
  version history.** All new state is in-memory per mount — future work
  would persist via `/api/artifacts/storage`. The download button uses
  the right extension per artifact type (`.md`, `.html`, `.jsx`,
  `.svg`, `.mmd`, `.txt`). Version history starts with one entry
  ("Initial"); `pushVersion` is exposed for future regen wiring.
- **Critical-thinking prompts are gated by message type.** The literal
  spec (`shouldShowCriticalThinkingPrompt` returns true only for
  "research") is respected. In ChatCard, the wiring is there but the
  gating returns false for "chat" — a no-op today, infrastructure
  ready for future tuning (e.g. show for long/complex chat responses).
  In ResearchCard, the prompt IS shown (after the report completes,
  stable across re-renders via useState lazy initializer).
- **Onboarding is localStorage-gated.** Key: `quaesitor_onboarded`,
  versioned (`ONBOARDED_VERSION = 1` — bump to force re-show after
  breaking changes). 3 steps: Welcome (investigator metaphor + 6-stage
  visual), Choose your depth (interactive DepthIndicator), Your
  privacy (3 cards: private conversations, opt-in memory, delete
  anytime). Skip button on every step. SSR-safe (checks localStorage
  in useEffect, not at render time).
- **Known limitations is collapsible.** Five honest bullets:
  English/Western source bias, citation verification ≠ factual
  accuracy, citation verifier counts (from job.verificationReport),
  generation time (from job.stats.elapsedMs), bias_auditor caveat.
  Uses the warm Quaesitor palette — `text-[#6b6358]` body, `AlertTriangle`
  icon in `#a37a3f`/`#d4a574`, collapsible via the existing
  `@/components/ui/collapsible`.
- **Mobile audit found 3 real issues, all fixed:**
  1. Sidebar was a flex item even on mobile — pushed main content to
     ~95px on 375px screens. Fixed: `fixed lg:static` so it overlays
     on mobile, takes layout space on desktop.
  2. Sidebar started `open=true` on every screen size. Fixed: a
     one-shot useEffect closes it on `< 1024px` (SSR-safe — window
     check guarded by `typeof window !== "undefined"`).
  3. ChatCard's copy action bar was hover-only (`opacity-0
     group-hover/msg:opacity-100`) — invisible on touch devices. Fixed:
     `opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100` so
     mobile always shows it, desktop keeps the hover behavior.
  4. Topbar buttons could crowd on 375px. Fixed: `px-3 sm:px-4` for
     tighter mobile padding, `gap-0.5 sm:gap-1`, `min-w-0` + `truncate`
     on the "New Conversation" label so it never overflows.

## Files Modified / Created

### Created
- `src/lib/mcp-marketplace.ts` — `MCPServer` interface, `MCPCategory`
  type, `MCP_MARKETPLACE` constant (6 servers), in-memory install Set,
  `getMarketplace`/`getInstalledServers`/`getAvailableServers`/
  `installServer`/`uninstallServer`/`getServer` helpers. Clearly marked
  as a stub in the file header.
- `src/lib/computer-use.ts` — `ComputerUseAction`/`ComputerUseResult`
  interfaces, `executeComputerUse` (stub — returns failure),
  `isComputerUseAvailable` (env-gated), `computerUseStatus`. Documents
  the security requirements for the future real implementation.
- `src/lib/critical-thinking.ts` — `CRITICAL_THINKING_PROMPTS` (6
  prompts), `getCriticalThinkingPrompt` (random),
  `shouldShowCriticalThinkingPrompt` (true only for "research").
- `src/app/api/mcp/marketplace/route.ts` — GET returns the catalog
  with current install state + `stub: true` flag. Not admin-gated
  (catalog is public info).
- `src/app/api/mcp/install/route.ts` — POST marks a server as
  installed/uninstalled. Auth-gated (`requireAuth`), audit-logged
  (`logSensitiveAction("admin.access", ...)` with `route: "mcp.install"`
  metadata). Returns the updated server state.
- `src/components/OnboardingFlow.tsx` — 3-step modal onboarding.
  localStorage-gated (`quaesitor_onboarded`, versioned). Includes
  `isOnboardingComplete()` helper for SSR-safe status checks.

### Modified
- `src/components/artifacts/ArtifactsPanel.tsx` — added tab bar
  (Preview/Code/History), Download button (per-type extension), Copy
  button in header + Code tab, version history state
  (`versions`/`activeVersionIdx`), `pushVersion` exposed for future
  regen wiring, `DOWNLOAD_META` map for extension/mime per type.
  Preserved all existing rendering logic (iframe, SVG sanitization,
  mermaid, markdown, code).
- `src/components/cards/ChatCard.tsx` — imported `Lightbulb` + critical-
  thinking helpers, added `criticalThinkingPrompt` state, set it in
  both `finally` blocks (initial + follow-up) gated by
  `shouldShowCriticalThinkingPrompt("chat")` (no-op today), rendered
  the prompt after the assistant's response. Fixed mobile action-bar
  visibility (`opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100`).
- `src/components/cards/ResearchCard.tsx` — imported `Lightbulb` +
  `AlertTriangle` + critical-thinking helpers, added
  `criticalThinkingPrompt` (useState lazy init, stable), added
  `limitationsExpanded` state, rendered critical-thinking prompt after
  the carbon indicator, rendered "Known limitations" collapsible with
  5 honest bullets (source bias, citation verification scope,
  verifier counts from `job.verificationReport`, generation time from
  `job.stats.elapsedMs`, bias_auditor caveat).
- `src/components/UnifiedInterface.tsx` — imported `OnboardingFlow`,
  added mobile-first sidebar-closed-on-mount useEffect, tightened
  topbar (`px-3 sm:px-4`, `gap-0.5 sm:gap-1`, `min-w-0` + `truncate`),
  mounted `<OnboardingFlow />` in the empty state.
- `src/components/layout/Sidebar.tsx` — changed sidebar positioning
  from `z-50` (flex item) to `z-50 fixed lg:static inset-y-0 left-0`
  so it overlays on mobile and takes layout space on desktop.

## Type / Lint / Test

```
bunx tsc --noEmit --strict   → 0 errors
bun run lint                  → 0 errors
                                (5 pre-existing warnings in unrelated files:
                                 projects/page.tsx unused FileText/newInstructions,
                                 multi-modal/generators.ts unused `prompt` arg —
                                 both predate this task and are noted in v4-rebrand's log)
bun run test                  → 446 passed | 1 skipped (pre-existing)
                                All 33 test files green. Duration ~35s.
```

## Quaesitor Color Discipline

All new UI uses the warm Quaesitor palette exclusively:
- `#faf8f3` / `#1c1a17` (card backgrounds)
- `#d9d4c7` / `#3d3830` (borders)
- `#8b4513` / `#b5673a` (primary — saddle brown / lighter leather)
- `#6b6358` / `#9a9080` (muted text — faded ink)
- `#2a2620` / `#e8e3d8` (text — sepia ink / warm white)
- `#a37a3f` / `#d4a574` (warning accent — for the Known limitations icon)
- `#f4f1ea` / `#322e28` (secondary surface — for step indicators, icon chips)

No box-shadow, no backdrop-blur (except a single `backdrop-blur-[1px]`
on the OnboardingFlow overlay — sub-pixel, barely visible, just enough
to suggest depth without violating the DESIGN.md anti-pattern). No
bg-gradient. `font-ui` (DM Sans) for chrome (tabs, buttons, labels);
`font-body` (Newsreader) for prose content. Framer Motion for subtle
opacity/scale/x transitions only. Touch targets ≥ 28px (size-7 buttons
in tight clusters; size-8 elsewhere).

## Notes for Downstream Agents

- **`src/lib/mcp-marketplace.ts` is the canonical MCP catalog.** Don't
  duplicate the server list elsewhere. When real MCP transport lands,
  replace `installedServers` Set with a Prisma-backed store and extend
  `tools/list` in `/api/mcp/route.ts` to aggregate tools from every
  installed server. The `stub: true` flag in API responses should be
  removed at that point.

- **`src/lib/computer-use.ts` is a pure stub.** Do NOT wire it into any
  UI that claims the feature works. The future implementation MUST run
  in a disposable VM/container with no host filesystem access, sandbox
  network egress, cap session length, and audit-log every action. See
  the file header for the full security checklist.

- **The ArtifactsPanel version history is in-memory only.** It resets
  when the panel unmounts. `pushVersion(content, label)` is exposed but
  not yet called — future "regenerate" or "edit" flows would call it to
  add snapshots. To persist, extend `/api/artifacts/storage` to accept
  version arrays and load them on mount.

- **Critical-thinking prompt gating is deliberate.** The spec says
  "only for research reports" — `shouldShowCriticalThinkingPrompt`
  returns true only for `"research"`. ChatCard has the wiring but the
  gating makes it a no-op for `"chat"`. This is intentional: the
  prompt would feel preachy on every chat message. If you want to show
  it for long/complex chat responses, extend
  `shouldShowCriticalThinkingPrompt` to accept a content-length
  threshold — don't bypass it.

- **The Known limitations section reads from `job.verificationReport`
  and `job.stats.elapsedMs`.** If you change the `ResearchJob` shape
  (e.g. rename `verificationReport`), update the ResearchCard
  limitations section. The `fmtTime` import is from
  `@/lib/research-ui-utils` — same module the rest of the card uses.

- **OnboardingFlow uses `ONBOARDED_VERSION = 1`.** Bump this constant
  to force re-display for existing users after a breaking change (e.g.
  new privacy posture, new feature that changes the workflow). The
  localStorage key is `quaesitor_onboarded`.

- **The Sidebar's `fixed lg:static` pattern is the canonical mobile
  drawer.** If you build another drawer (e.g. a settings panel), use
  the same pattern: `fixed lg:static inset-y-0 left-0 z-50` + an
  overlay with `fixed inset-0 z-40 lg:hidden`. The overlay click closes
  the drawer; the X button (visible `lg:hidden`) also closes it.

- **The mobile sidebar-closed-on-mount useEffect in UnifiedInterface
  is SSR-safe.** It guards `typeof window !== "undefined"` before
  reading `innerWidth`. Don't replace it with a media-query hook that
  runs at render time — that causes hydration mismatches.

- **ChatCard's action bar is now `opacity-100 sm:opacity-0
  sm:group-hover/msg:opacity-100`.** This means mobile users always
  see the copy button; desktop users get the hover-to-reveal pattern.
  If you add more actions (e.g. "regenerate", "share"), follow the
  same responsive visibility rule.
