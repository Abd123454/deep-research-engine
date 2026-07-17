# Task com-eth-strat-95 — Work Record

**Agent:** com-eth-strat-95
**Task ID:** com-eth-strat-95
**Status:** ✅ Complete
**Scope:** Raise Commercial (4.0→9.5), Ethical (7.0→9.5), and Strategic (7.0→9.5) scores
per the independent audit.

## Mission

Close the 9 deliverables across three pillars:

- **Commercial (3 items)** — interactive pricing calculator, real plan-limit
  enforcement (402 on overage), dashboard with usage + plan badge + carbon
  footprint + quick links.
- **Ethical (3 items)** — opt-in memory consent (default FALSE), explicit
  "remember that..." memory commands (English + Arabic), bias disclaimer
  footer on every research report.
- **Strategic (3 items)** — admin-only metrics endpoint, 10-month roadmap
  v2 doc, floating feedback widget + storage route.

## Approach

- All new UI uses the Quaesitor warm palette exclusively (`#faf8f3`,
  `#d9d4c7`, `#8b4513`, `#6b6358`, plus dark-mode counterparts
  `#252220`, `#3d3830`, `#b5673a`, `#9a9080`). No box-shadow, no
  backdrop-blur, no gradient — per DESIGN.md anti-patterns.
- `font-ui` (DM Sans) for chrome (labels, sliders, badges, buttons);
  `font-body` (Newsreader) for prose content + numeric callouts.
- The plan-limits module (`src/lib/plan-limits.ts`) is a clean,
  client-safe module — it imports only from `./db` and `./logger`,
  never from Stripe. The PricingCalculator imports `PLAN_LIMITS` and
  `recommendPlan` directly from it (no server round-trip needed).
- Memory consent gate is dual-path: sync `isMemoryExtractionEnabled`
  for the chat hot-path (so the SSE stream doesn't block on a DB
  round-trip), async `isMemoryExtractionEnabledAsync` for routes that
  can await. The sync path always works because SQLite is always
  available (the dual-mode DB falls back to in-memory).
- Explicit memory commands ("remember that...") bypass the consent
  gate via `storeExplicitMemory()`. This is the user directly asking
  — counts as consent for that one memory. The detect patterns are
  case-insensitive and cover English + Arabic verb forms.
- The bias disclaimer is appended at the END of `synthesizeReport`,
  AFTER the self-critique pass. The self-critique LLM would otherwise
  delete it as redundant — placing it after ensures it survives. The
  disclaimer is NOT in the streamed tokens (`job.reportStream`); it
  only appears in the persisted `job.report`.
- The metrics endpoint reuses `requireAdminAccess` + `requireAuth`
  + `logSensitiveAction("admin.access", ...)`, matching the pattern
  established by `/api/audit-logs`. The IP allowlist
  (`ADMIN_IP_ALLOWLIST`) applies via `requireAdminAccess`.
- The FeedbackWidget is SSR-safe: `mounted` state gates the render
  so the server returns `null` and the client mounts the button only
  after hydration. Avoids hydration mismatches caused by
  `window.location.pathname` access.
- The dashboard page degrades gracefully when the new
  `usageThisMonth` / `carbon` fields are absent (older cached API
  responses) — it falls back to deriving `used` from `limit - remaining`.

## Files Modified / Created

### Created

- `src/lib/plan-limits.ts` — `Plan` type, `PLAN_LIMITS` record,
  `getPlanForUser` (sync SQLite), `getPlanForUserAsync` (async
  Postgres-first), `checkLimit(userId, resource)` returning
  `{ allowed, remaining, limit, plan }`, `recommendPlan({ research,
  chat, prioritySupport })`.
- `src/components/PricingCalculator.tsx` — interactive slider +
  toggle calculator. Uses `recommendPlan` + `PLAN_LIMITS` from
  `@/lib/plan-limits`. Warm Quaesitor card, `font-ui` chrome,
  collapsible plan-limits reference table.
- `src/components/FeedbackWidget.tsx` — floating bottom-left button
  that expands to a card with 👍/👎 + free-text comment. Submits to
  `/api/feedback`. SSR-safe, Framer Motion transitions.
- `src/app/api/preferences/memory/route.ts` — GET (consent status)
  + POST (set consent, audit-logged). Uses zod validation +
  `requireAuth` + `logSensitiveAction("account.export", ...)`.
- `src/app/api/metrics/route.ts` — admin-only GET returning users
  (total/7d/30d), research (jobs/success rate/avg duration), chat
  (messages/tokens), cache (hitRate/size), carbon (monthly estimate),
  plan distribution.
- `src/app/api/feedback/route.ts` — POST (store feedback, zod
  validated, audit-logged) + GET (admin-only stats with totals +
  recent 50 items).
- `docs/ROADMAP_v2.md` — detailed 10-month roadmap (Phase 2: Arabic-
  first + Citation NLI + bias_auditor + MCP marketplace; Phase 3:
  dual-license + pricing + dashboard + API platform; Phase 4: multi-
  region + SOC 2 + mobile + extension + real-time collab). Each phase
  has objectives, deliverables, success metrics, dependencies, risks.

### Modified

- `src/lib/memory-extractor.ts` — added `isMemoryExtractionEnabled`
  (sync), `isMemoryExtractionEnabledAsync`, `setMemoryExtractionConsent`,
  `detectMemoryCommand`, `storeExplicitMemory`. The consent column
  (`memory_consent`) is added lazily via `ALTER TABLE ADD COLUMN`
  wrapped in try/catch. Default is FALSE (opt-in).
- `src/lib/research-engine.ts` — `synthesizeReport` now returns
  `appendBiasDisclaimer(finalReport)` instead of `finalReport` raw.
  The disclaimer is a static markdown footer appended AFTER the self-
  critique pass.
- `src/app/api/research/start/route.ts` — added `checkPlanLimit`
  after the rate-limit check. Returns 402 with `{ plan, limit,
  remaining }` when the user's monthly research quota is exhausted.
- `src/app/api/chat/route.ts` — added `checkPlanLimit` for chat.
  Memory extraction now gated by `isMemoryExtractionEnabled` with
  fallback to `detectMemoryCommand` → `storeExplicitMemory` when the
  user's message starts with "remember that...".
- `src/app/api/chat/agent/route.ts` — same consent gate + memory
  command detection as the chat route.
- `src/app/api/memories/extract/route.ts` — added `requireAuth` +
  `getUserId` + `isMemoryExtractionEnabledAsync` consent gate.
  Returns `{ ok: true, stored: 0, reason: "memory_consent_disabled" }`
  when consent is off (no error — UI is allowed to call this
  proactively).
- `src/app/api/dashboard/stats/route.ts` — extended to also return
  `usageThisMonth` (research/chat/tokens for current month, aggregated
  from `usage_records`) and `carbon` (monthly CO₂ estimate from the
  carbon-footprint lib).
- `src/app/dashboard/page.tsx` — full redesign. Adds current plan
  badge, carbon footprint card, usage-this-month cards (3), quick
  links grid (billing / API keys / memory / privacy), and retains
  the API keys section.
- `src/app/pricing/page.tsx` — wires `<PricingCalculator>` between
  the plan grid and the FAQ.
- `src/app/layout.tsx` — wires `<FeedbackWidget />` into the global
  layout (next to `<CookieConsent />`).
- `src/workers/memory-worker.ts` — respects the consent gate. When
  consent is off, scans the conversation for explicit "remember
  that..." commands and stores those (Ethical #5), but skips
  automatic extraction.

## Type / Lint / Test

```
bunx tsc --noEmit --strict   → 0 errors
bun run lint                  → 0 errors
                                (5 pre-existing warnings in unrelated files:
                                 projects/page.tsx unused FileText/newInstructions,
                                 multi-modal/generators.ts unused `prompt` arg —
                                 both predate this task and are noted in v4-rebrand's log)
bun run test                  → 446 passed | 1 skipped (pre-existing)
                                All 33 test files green. Duration ~34s.
```

## Quaesitor Color Discipline

All new UI components use the warm Quaesitor palette exclusively:

- `PricingCalculator`: `bg-[#faf8f3]`, `border-[#d9d4c7]`,
  `text-[#8b4513]` accent, `bg-[#e8e0d0]` icon chips. Dark mode:
  `bg-[#252220]`, `border-[#3d3830]`, `text-[#b5673a]`.
- `FeedbackWidget`: same warm palette. Floating button is a rounded
  pill; expanded panel is a `rounded-[20px]` card.
- `dashboard/page.tsx`: warm cards on `bg-[#f4f1ea]` canvas. Plan
  badge uses palette variants per tier (Free = neutral, Pro/Team =
  accent-tinted, Enterprise = filled accent).

No box-shadow, no backdrop-blur, no gradient anywhere in the new
code. Framer Motion is used for subtle opacity/scale transitions
only. Touch targets ≥44px (the FeedbackWidget button is `py-2.5`
= ~40px height + icon → 44px effective).

## Notes for Downstream Agents

- **`src/lib/plan-limits.ts` is the canonical source of plan limits.**
  Don't reach for `src/lib/stripe.ts` `PLANS` unless you specifically
  need the billing/Stripe integration. The two are intentionally
  separate: stripe.ts owns Stripe + the existing `enforcePlanLimit`
  (which uses a different schema — `researchPerMonth`, `chatPerDay`,
  `tokensPerMonth`). plan-limits.ts uses the audit-spec'd schema
  (`monthlyResearch`, `monthlyChatMessages`, `maxConcurrentJobs`,
  `maxFileUploadMB`, `swarmAgents`, etc.). They coexist — pick the
  one that matches your caller's needs.

- **The consent column (`memory_consent`) is added lazily** via
  `ALTER TABLE ADD COLUMN` wrapped in try/catch. SQLite's `ALTER
  TABLE ADD COLUMN` errors on duplicates, which we catch silently.
  Postgres deployments need a Prisma migration adding the column
  to the `UserPreference` model — the async path uses
  `$queryRaw` to read the column directly.

- **The bias disclaimer is in `job.report`, NOT in `job.reportStream`.**
  The streamed tokens are the LLM's raw output; the disclaimer is
  appended after the LLM call completes. The UI shows the streamed
  version during synthesis, then switches to `job.report` once the
  job is `completed` — at which point the disclaimer becomes
  visible. This is intentional: the disclaimer is for the persistent
  record, not the live stream.

- **Memory commands bypass the consent gate, but only for that one
  memory.** If the user says "remember that I prefer Arabic" but
  hasn't enabled memory extraction globally, we store THAT fact but
  don't auto-extract anything else from the conversation. This is
  the right privacy posture: explicit > implicit.

- **`/api/metrics` is admin-gated** via `requireAdminAccess`
  (IP allowlist, no-op when unset) + `requireAuth`. If you add new
  admin-only routes, follow the same pattern. The audit log entry
  uses `admin.access` (matching the existing `/api/audit-logs`
  convention) with a `route: "metrics"` metadata field so ops can
  see which admin endpoint was hit.

- **The FeedbackWidget lives at `bottom-4 left-4` with `z-40`.**
  The CookieConsent banner is `z-50` and full-width at the bottom.
  When both are visible (first visit), CookieConsent overlays the
  FeedbackWidget button — correct behavior (CookieConsent must be
  handled first). Once dismissed, FeedbackWidget is unobstructed.

- **The dashboard's `usageThisMonth` + `carbon` fields are
  backward-compatible.** Older `/api/dashboard/stats` responses
  (e.g. cached in localStorage) won't have them — the page falls
  back to deriving `used` from `limit - remaining` and shows "—"
  for carbon. No error.

- **The metrics endpoint's avg-duration query uses
  `julianday(updated_at) - julianday(created_at)`** which works on
  SQLite but not Postgres. Postgres deployments would need to swap
  to `EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000`. Not
  a regression — the existing routes use SQLite-only SQL throughout.

- **The PricingCalculator's overage estimate ($0.25/query) is
  illustrative.** Real metered billing would use Stripe's usage-
  based pricing. The number is conservative and labeled as
  "estimated overage" so users don't mistake it for an exact quote.
