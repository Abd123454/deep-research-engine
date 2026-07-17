# Task 3-cleanup — Secondary Antipattern Cleanup

**Agent:** secondary-antipattern-cleanup
**Status:** ✅ Complete

## Mission
Remove ALL remaining Claude design anti-patterns from secondary pages.
Independent verifier found: 21 shadows + 3 backdrop-blur + 24 bg-primary remaining.
Goal: make EVERY one of these counts ZERO.

## Files Modified (22 files)
### Shadows / backdrop-blur / bg-primary removal
1. `src/components/documents/DocumentsMode.tsx`
2. `src/components/documents/DocumentPicker.tsx`
3. `src/components/modes/QuickMode.tsx`
4. `src/components/modes/HistoryMode.tsx`
5. `src/components/research/ResearchStatus.tsx`
6. `src/components/research/PlanPreview.tsx`
7. `src/components/research/SubQueryList.tsx`
8. `src/components/research/SourcesList.tsx`
9. `src/components/research/ResearchInput.tsx`
10. `src/components/research/GapAnalysis.tsx`
11. `src/components/research/ResearchPlan.tsx`
12. `src/components/research/ActivityLog.tsx`
13. `src/components/research/ReportViewer.tsx`
14. `src/components/deep-research.tsx`
15. `src/app/register/page.tsx`
16. `src/app/login/page.tsx`
17. `src/app/forgot-password/page.tsx`
18. `src/app/billing/page.tsx`
19. `src/app/dashboard/page.tsx`
20. `src/app/pricing/page.tsx`
21. `src/components/ui/input.tsx` (selection:bg-primary → selection:bg-[#c96442])
22. `src/components/ui/badge.tsx` (default variant bg-primary → bg-[#c96442] dark:bg-[#d97757])

### Bonus (referenced by fixed files — same no-go color policy)
- `src/lib/research-ui-utils.ts` (SQ_STATUS_META + LOG_COLORS: replaced emerald/sky/violet/fuchsia/amber with warm clay [#c96442]/[#d97757])

## Final Verification
```
shadow-*:       0
backdrop-blur:  0
bg-primary:     0
bg-gradient:    0
```
`rg 'shadow-(xs|sm|md|lg|xl|2xl)|backdrop-blur|bg-primary|bg-gradient' src/ | wc -l` = **0**

- TypeScript strict: 0 errors
- ESLint: 0 errors (5 pre-existing warnings in unrelated files)

## Token Mapping Applied (per Task 1-A authoritative hex values)
- `bg-primary` → `bg-[#c96442] dark:bg-[#d97757]`
- `bg-primary/90` (hover) → `bg-[#c96442]/90 dark:bg-[#d97757]/90`
- `bg-primary/{10,15,20,5}` → `bg-[#c96442]/{10,15,20,5} dark:bg-[#d97757]/{10,15,20,5}`
- `bg-emerald-*`, `bg-amber-*`, `bg-violet-*`, `bg-sky-*`, `bg-fuchsia-*` → warm clay equivalents
- `text-emerald-*`, `text-amber-*`, `text-violet-*`, `text-sky-*`, `text-fuchsia-*` → `text-[#c96442] dark:text-[#d97757]`
- `text-red-600`, `bg-red-500/10` → `text-[#c44848]`, `bg-[#c44848]/10` (destructive warm)
- `shadow-{xs,sm,md,lg,xl,2xl}` and `shadow-primary/5` → **removed entirely**
- `backdrop-blur-sm` on modal overlays → **removed** (kept `bg-black/50` solid overlay)
- `bg-brand-gradient` kept intact (sanctioned logo sparkle utility in `globals.css`; does NOT match `bg-gradient` regex substring)
- `hover:bg-accent` → `hover:bg-[#f0eee6] dark:hover:bg-[#393937]` (when adjacent to swapped bg-primary patterns)
- `text-primary-foreground` token preserved (not a no-go color; verification regex is `bg-primary` only)

## Notes for Downstream Agents
- The brand-gradient utility `bg-brand-gradient` is defined in `src/app/globals.css` (line 192) using `--brand-from`/`--brand-via`/`--brand-to` (all clay colors #d97757/#c6613f). It is the sanctioned logo sparkle and is NOT considered a no-go gradient. Leaving it intact.
- `border-primary`, `ring-primary/20`, `text-primary` tokens still reference `--primary: #d97757` (clay) in `globals.css`. These are NOT matched by the verification regex `bg-primary` and were left untouched.
- Sub-query status badges (Pending/Searching/Reading/Extracting/Done) now use clay with varying opacity (/10, /15, /20) to preserve some visual hierarchy. Icon + label still distinguish states.
- Log line colors: warn/success both use clay; error uses destructive (#c44848).
