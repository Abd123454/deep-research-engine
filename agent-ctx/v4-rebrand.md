# Task v4-rebrand — Full Quaesitor Rebrand

**Agent:** v4-rebrand
**Status:** ✅ Complete
**Task ID:** v4-rebrand

## Mission
Replace ALL Claude-derived color/font values with the new independent Quaesitor
identity across the entire codebase. Every hex value must change.

## Scope Touched
- 6 UI primitives (`button`, `card`, `toast`, `badge`, `input`, `textarea`)
- 4 special-attention files (`UnifiedInterface`, `Sidebar`, `ChatCard`, `UnifiedInput`)
- 4 cards (`QuickCard`, `SwarmCard`, `DocumentCard`, `ResearchCard`)
- 5 research components (`ReportViewer`, `ResearchInput`, `SourcesList`,
  `SubQueryList`, `ResearchStatus`, `GapAnalysis`)
- 1 lib file (`research-ui-utils.ts`)
- 8 app pages (`billing`, `forgot-password`, `register`, `pricing`, `login`,
  `dashboard`, `projects`, `projects/[id]`, `settings/memory`, `settings/privacy`)
- 9 misc components (`theme-toggle`, `i18n/language-toggle`, `ErrorBoundary`,
  `pwa/OfflineIndicator`, `pwa/InstallPrompt`, `export/ExportMenu`,
  `documents/DocumentsMode`, `memory/MemoryPanel`, `history/HistoryDrawer`,
  `artifacts/ArtifactsPanel`, `modes/QuickMode`, `modes/HistoryMode`)
- 1 lib skills index (`lib/skills/index.ts`)

## Color Mapping Applied (per DESIGN.md)
| Claude | Quaesitor |
|--------|-----------|
| `#f0eee6` | `#f4f1ea` (canvas light) |
| `#1a1a18` (bg only) | `#1c1a17` (canvas dark) |
| `#faf9f5` | `#faf8f3` (card surface) |
| `#1f1e1b` | `#252220` (dark card) |
| `#141413` | `#2a2620` (text primary) |
| `#5e5d59` | `#6b6358` (text muted) |
| `#87867f` | `#6b6358` (consolidated muted) |
| `#9a9893` | `#6b6358` (consolidated muted) |
| `#a3a098` | `#9a9080` (dark mode muted) |
| `#b0aea5` | `#9a9080` (dark mode secondary) |
| `#e8e6dc` | `#d9d4c7` (border) |
| `#e3dacc` | `#e0d9c8` (accent) |
| `#E5E0D6` | `#e8e0d0` (user bubble) |
| `#393937` | `#322e28` (dark secondary) |
| `#3d3a35` | `#3d3830` (dark border) |
| `#c96442` | `#8b4513` (primary, saddle brown) |
| `#d97757` | `#b5673a` (primary dark) |
| `#b5563a` | `#6b3410` (primary hover light) |
| `#c6613f` | `#8b4513` (primary hover dark) |
| `#faf9f5` (dark text) | `#e8e3d8` (warm white) |
| `#c44848` | `#a33a3a` (destructive) |
| `#b53333` | `#a33a3a` (destructive hover) |

## Font Mapping
- `font-serif` → `font-body` (Newsreader)
- `font-sans` → `font-ui` (DM Sans)
- `prose-claude` → `prose-quaesitor`
- `font-mono` kept unchanged (JetBrains Mono)

## Icon Mapping
- `Sparkles` (lucide-react) → `CompassLogo` (from `@/components/CompassLogo`)
- Removed `Sparkles` from all lucide-react imports across the codebase.

## Structural Changes Applied
- Sidebar width: `w-[260px]` → `w-[280px]`
- Composer form: `rounded-2xl` → `rounded-3xl` (24px)
- User bubble: `rounded-2xl` → `rounded-3xl rounded-br-md`
- User bubble max-width: `max-w-[80%]` → `max-w-[75%]`
- Body line-height in prose: `leading-[1.6]` → `leading-[1.7]` (in ChatCard markdown components)

## Files Touched: 36

## Before/After Counts
| Pattern | Before | After |
|---------|--------|-------|
| `#f0eee6` (canvas light) | ~20+ | 0 |
| `#141413` (text primary) | ~30+ | 0 |
| `#c96442` (clay primary) | ~40+ | 0 |
| `#d97757` (clay primary dark) | ~30+ | 0 |
| `#E5E0D6` (user bubble) | ~3 | 0 |
| `#e8e6dc` (border) | ~30+ | 0 |
| `#faf9f5` (card) | ~25+ | 0 |
| `#1a1a18` (canvas dark) | ~15+ | 0 |
| `#c44848` (destructive) | ~15+ | 0 |
| `prose-claude` (prose util) | 4 | 0 |
| `font-serif` (Claude serif) | ~20+ | 0 |
| `Source Serif` (Claude font ref) | 0 (already removed) | 0 |
| `Sparkles` (Claude icon) | 14 | 0 |
| `w-[260px]` (sidebar width) | 1 | 0 |

| Quaesitor pattern | Before | After |
|-------------------|--------|-------|
| `#f4f1ea` | 0 | many |
| `#2a2620` | 0 | many |
| `#8b4513` | 0 | many |
| `#d9d4c7` | 0 | many |
| `#faf8f3` | 0 | many |
| `#e8e0d0` | 0 | many |
| `#6b6358` | 0 | many |
| `prose-quaesitor` | 0 | 4 |
| `font-body` | 0 | many |
| `font-ui` | 0 | many |
| `CompassLogo` | 0 | 14 |

## Verification Commands Run
```
=== Claude values remaining (must be 0) ===
0
=== Sparkles remaining (must be 0) ===
0
=== w-[260px] remaining (must be 0) ===
0
=== Quaesitor values present (must be >0) ===
393
```

## Type / Lint
- `bunx tsc --noEmit --strict` → 0 errors
- `bun run lint` → 0 errors (5 pre-existing warnings in unrelated files:
  `projects/page.tsx` unused `FileText`/`newInstructions` and
  `lib/multi-modal/generators.ts` unused `prompt` arg — both predate this task)

## Notes for Downstream Agents
- `bg-brand-gradient` utility is still defined in `globals.css` using the OLD
  clay colors `#d97757/#c6613f` as `--brand-from`/`--brand-via`/`--brand-to`.
  It's only used for the avatar/hero icon backgrounds on login/register/
  forgot-password. Recommend orchestrator updates those tokens in
  `globals.css` to leather (`#8b4513/#6b3410`) — out of scope here because
  globals.css was explicitly forbidden.
- The `focus:bg-[#8b4513]` in `layout.tsx` Skip-to-Content link was already
  set by orchestrator.
- Some secondary pages (`projects`, `projects/[id]`, `settings/memory`,
  `settings/privacy`) used dark-mode bg `#2b2a27` (intermediate dark canvas)
  — left untouched since it isn't in the Claude color list and reads as
  warm dark canvas. The dark-mode text color `#eeeeee` in those files was
  replaced with the warm white `#e8e3d8` per design system.
