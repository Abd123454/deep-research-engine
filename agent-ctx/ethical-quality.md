# Task ethical-quality — 5 Ethical/Quality Improvements

**Agent:** ethical-quality
**Status:** ✅ Complete
**Task ID:** ethical-quality
**Scope:** Multi-cultural sources, two new swarm roles (fact_checker, bias_auditor), contradiction detection in the citation verifier, dual-license scaffolding (utility + commercial addendum).
**Prior work consulted:** `worklog.md` (security-fixes + ui-fixes + agent cluster design), `src/lib/swarm.ts`, `src/lib/source-quality.ts`, `src/lib/citation-verifier.ts`, `src/components/cards/SwarmCard.tsx`, existing tests in `src/lib/__tests__/`.

## Mission

The independent audit identified five ethical and quality gaps in Quaesitor:

1. The Tier 1 source allow-list is Western-only — Arabic, Chinese, Japanese, Korean, and Indian sources of record are missing, which biases every research query toward Anglophone perspectives.
2. The agent swarm has no roles for fact-checking or bias auditing — claims are synthesized without a verification pass, and regional/cultural balance is never inspected.
3. The citation verifier checks "URL exists + text appears" but cannot detect when a cited source actively contradicts the claim it is cited for — a stronger failure mode than mere absence of support.
4. The project is dual-licensed (AGPL-3.0 + a forthcoming commercial license) but has no programmatic way to detect which mode a deployment runs in.
5. No commercial license addendum exists yet — enterprises cannot legally opt out of the AGPL's network-source-disclosure obligation.

## Approach

All five improvements were implemented as additive changes that preserve existing test contracts. No public API was broken; the new `warnings` field on `VerificationReport` and `warning?` field on `CitationCheck` are optional and additive. The new swarm roles plug into the existing orchestrator prompt and inherit the existing ReAct worker loop unchanged. The new source domains are appended to the existing `TIER1_DOMAINS` array, so existing tier-1/2/3 score arithmetic is untouched.

## Files Modified / Created

### Created
- `src/lib/license.ts` — License-detection utility (91 lines).
  Exports `getLicenseMode()`, `isCommercial()`, `getLicenseNotice()`, `getLicenseFooter()`, `getLicenseSpdxId()`. Reads `process.env.LICENSE_MODE` at call time (no module-load caching) so hot-reloaded env vars are respected. Default mode is `"agpl"` — the more restrictive license wins when in doubt.
- `COMMERCIAL_LICENSE.md` — Commercial license addendum (~1070 words, 8 numbered sections).
  Covers: Grant of License (perpetual, worldwide, non-exclusive), AGPL Exemption (§13 network-source-disclosure waived), Permitted Use (internal, SaaS, white-label), Restrictions (no resale, no copyright-notice removal), Fees (indicative tiers — Team / Enterprise / SaaS Operator), Warranty & Liability (AS-IS, liability capped at 12 months of fees), Termination (30-day cure, AGPL exemption ceases immediately on termination), Miscellaneous (governing law, assignment, entire agreement, amendment). Contact: `commercial@quaesitor.local` (placeholder).

### Modified
- `src/lib/source-quality.ts` — Added 21 new Tier 1 domains across cultures.
  - Arabic: `manhal.com`, `almanhal.com` (Al-Manhal / دار المنهل); `mandumah.com`, `search.mandumah.com` (Dar Al-Mandumah); `jstor.org` (multilingual archive).
  - Chinese: `cnki.net`, `kns.cnki.net`, `oversea.cnki.net` (CNKI / 中国知网); `xueshu.baidu.com` (Baidu Scholar / 百度学术); `cas.cn`, `english.cas.cn` (Chinese Academy of Sciences / 中国科学院).
  - Japanese: `jstage.jst.go.jp` (J-STAGE); `ci.nii.ac.jp` (CiNii).
  - Korean: `dbpia.co.kr` (DBpia); `riss.kr` (RISS).
  - Open access: `doaj.org` (DOAJ); `openalex.org` (OpenAlex); `core.ac.uk` (CORE); `ncbi.nlm.nih.gov`, `pmc.ncbi.nlm.nih.gov` (PubMed Central host).
  - Regional news of record: `aljazeera.com` (Al Jazeera English); `scmp.com` (South China Morning Post); `asia.nikkei.com`, `nikkei.com` (Nikkei Asia); `thewire.in` (The Wire, India); `thehindu.com` (The Hindu, India); `yonhapnews.co.kr` (Yonhap, Korea); `haaretz.com` (Haaretz, Israel/Middle East).
  Header comment updated to document the multi-cultural intent. `TIER1_SUFFIXES` and `TIER2_DOMAINS` unchanged.

- `src/lib/swarm.ts` — Added `fact_checker` and `bias_auditor` to the `AgentRole` union.
  - `ROLE_PROMPTS`: fact_checker prompt instructs it to rate every claim as `verified / partially-supported / unsupported / contradicted` and to verify quotes, numbers, dates, and causal assertions specifically. bias_auditor prompt instructs it to flag source geography (>70% from one country = bias), missing Global South / non-Western / minority perspectives, linguistic gaps (English-only sources on a topic best covered in another language), ideological clustering, and loaded terminology.
  - `ROLE_TOOLS`: both new roles get `["web_search"]` only — they verify and audit, they don't execute code.
  - `PLAN_SYSTEM_PROMPT`: listed both new roles with one-line summaries; added guidance on when to invoke them (fact_checker for numerical/date/quote accuracy, bias_auditor for contested topics or single-region-dominated source sets).
  - `validateRole`: extended the role-name allowlist.
  - **Backward compatibility:** `planSwarm`'s fallback paths (malformed JSON, empty subtasks array, invalid role) all still coerce to `generalist`. Existing tests pass unchanged.

- `src/components/cards/SwarmCard.tsx` — Extended the local `AgentRole` type and the `ROLE_ICON` / `ROLE_COLOR` / `ROLE_LABEL` maps to cover all 9 roles (including `security_analyst` and `electrical_engineer`, which were missing from the previous UI map and would have caused runtime `undefined` icon crashes if the orchestrator ever returned them).
  - fact_checker → `ShieldCheck` icon, label "Fact Checker", color `#8b6f47` (warm saddle brown per task spec).
  - bias_auditor → `Scale` icon, label "Bias Auditor", color `#a37a3f` (per task spec).
  - security_analyst → `Shield` icon (new), color `#7a5a3a`.
  - electrical_engineer → `Zap` icon (new), color `#9b6b3f`.
  All colors stay within the Quaesitor saddle-brown palette; no Claude/Anthropic purples or blues introduced. Imports extended to include `Shield`, `Zap`, `ShieldCheck`, `Scale` from `lucide-react`.

- `src/lib/citation-verifier.ts` — Added contradiction detection (Citation Verification 2.0).
  - New exported `detectContradiction(claim, sourceContent)` function implementing a simplified NLI check per the audit spec:
    1. Extract key terms from the claim (content words ≥4 chars, filtered against an English stopword list).
    2. Find each key term in `sourceContent` (case-insensitive, whole-token match).
    3. If NO key terms found → `status: "unclear"` (source doesn't address the claim).
    4. If key terms found, scan a ±5-word window around each occurrence for any of ~45 negation markers (`not`, `no`, `denies`, `refutes`, `false`, `incorrect`, `retracted`, `debunked`, …).
    5. If negation found near any key term → `status: "contradicts"` with confidence 0.5–0.85.
    6. Otherwise → `status: "supports"` (low confidence 0.4).
  - `CitationCheck.warning?: string` field added (optional, additive).
  - `VerificationReport.warnings: string[]` field added (additive; populated with one entry per contradicted citation).
  - `verifyCitation` pipeline: when `isTextSupported` returns `false`, the new `detectContradiction` is invoked. If it returns `"contradicts"`, `supportsClaim` becomes `"contradicts"` and a human-readable warning is attached. Otherwise the previous `"unverified"` behaviour is preserved.
  - `verifyAllCitations` now also populates the aggregate `warnings` array.
  - **Backward compatibility:** all 17 existing citation-verifier tests pass unchanged — the contradiction check only kicks in when fuzzy match already failed, and the existing test cases (Eiffel-Tower-claim-against-RISC-V-source, hallucinated-URL-not-in-sources, empty-cited-text) all map to `"unclear"` or are short-circuited before the contradiction check fires.

- `src/components/cards/ResearchCard.tsx` — Citation-verification badge now surfaces contradictions distinctly.
  - When `verificationReport.contradicts > 0`, a separate `✕ N contradiction(s)` badge is rendered next to the existing `⚠ N unverified / M total` badge. Badge uses the existing Quaesitor error-red `#a33a3a` (already used elsewhere in the codebase for error states — no new color introduced).
  - The contradiction badge's `title` attribute is set to the joined `warnings` array, so hovering reveals the per-citation negation evidence ("negation 'not' near key term 'risc-v' …") without consuming screen real estate.
  - Existing "all verified" path (`unverified === 0 && contradicts === 0`) is unchanged.

## Type / Lint / Tests

```
bunx tsc --noEmit --strict   → 0 errors
bun run lint                  → 0 errors
                                (5 pre-existing warnings in unrelated files:
                                 projects/page.tsx unused FileText/newInstructions,
                                 multi-modal/generators.ts unused `prompt` arg —
                                 both predate this task and are noted in v4-rebrand's log)
bun run test                  → 446 passed | 1 skipped | 0 failed
                                (no test files modified; all 33 test files pass
                                 unchanged, including source-quality.test.ts,
                                 citation-verifier.test.ts, swarm.test.ts,
                                 verifier-loop.test.ts, research-engine-integration.test.ts)
```

## Quaesitor Color Discipline

All new UI colors stay within the saddle-brown / sepia palette documented in `DESIGN.md`:

- SwarmCard new-role colors: `#8b6f47`, `#a37a3f`, `#7a5a3a`, `#9b6b3f` (warm browns matching the existing researcher/coder/analyst/writer/generalist spectrum). All on the existing `#f4f1ea` light / `#322e28` dark background.
- ResearchCard contradiction badge: `#a33a3a` (the existing error-red already used by `AlertCircle` and the swarm error banner in `SwarmCard.tsx`). No new red introduced.
- COMMERCIAL_LICENSE.md and `license.ts` introduce no UI colors.
- No Claude/Anthropic purple or blue was introduced anywhere.

## Notes for Downstream Agents

- **The `LICENSE_MODE` env var is the single source of truth for license state.** Read it via `getLicenseMode()` from `src/lib/license.ts` — do NOT read `process.env.LICENSE_MODE` directly elsewhere. If you add a feature that should be commercial-only (e.g. white-label removal of "Powered by Quaesitor"), gate it on `isCommercial()` from this module. The default is `"agpl"` — operators must explicitly set `LICENSE_MODE=commercial` to opt in.
- **`getLicenseMode()` is intentionally uncached.** It re-reads the env var on every call so hot-reloaded environments (e.g. Docker container restart with a new env) are picked up without a module reload. Don't "optimize" it with module-level memoization.
- **The two new swarm roles are first-class.** If you extend `ROLE_PROMPTS` or `ROLE_TOOLS` further, the `validateRole` allowlist and the `PLAN_SYSTEM_PROMPT` role listing must be kept in sync — `validateRole` is the boundary that protects against LLM-invented role names. Both new roles currently get `web_search` only; if a future fact-checker feature needs `run_code` (e.g. to recompute a cited statistic), add it to `ROLE_TOOLS.fact_checker`.
- **`detectContradiction` is a deliberately weak signal.** It catches "X is not Y" / "X denies Y" / "X is false" style contradictions but misses antonym-based ("X is closed" vs source "X is open") and paraphrased contradictions. Don't treat a `contradicts` verdict as ground truth — surface it as a warning to the user, not as a hard block. If you wire it into a stricter enforcement path (e.g. auto-rejecting reports with contradictions), add an LLM-based second-pass verifier first.
- **The new `warnings` field on `VerificationReport` is additive.** Older callers (e.g. `research-engine.ts`, the mock in `research-engine-integration.test.ts`) don't read it — they continue to work. If you add a new caller that wants to surface warnings, read `report.warnings ?? []` defensively because the mock in the integration test returns a partial object without `warnings`.
- **The source-quality tier lists are now multi-cultural.** When a user queries a non-Western topic, you should expect Tier 1 to include non-English domains. Do NOT add a "language" filter that drops non-English sources by default — that would re-introduce the Western bias this task removed. If you need a language filter for a specific use case (e.g. accessibility for screen readers), make it opt-in.
- **SwarmCard's `AgentRole` type now matches `swarm.ts`'s `AgentRole` type.** They are not formally unified (one is exported from a server module, the other is a local client type) but they have the same string-literal union. If you add a role to `swarm.ts`, also add it to `SwarmCard.tsx`'s `ROLE_ICON` / `ROLE_COLOR` / `ROLE_LABEL` maps or the UI will crash with `undefined` icon when the orchestrator assigns the new role.
- **COMMERCIAL_LICENSE.md is documentation, not a contract.** It's tracked in version control so enterprises can read it, but the actual signed agreement lives outside the repo. Don't edit it casually — changes to the commercial terms must be reviewed by counsel. The placeholder contact address `commercial@quaesitor.local` must be replaced before signature.
