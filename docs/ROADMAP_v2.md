# Quaesitor — Roadmap v2 (Phase 2–4)

**Status:** Living document. Replace the high-level 2026 quarterly themes in
`/ROADMAP.md` with operational, milestone-tracked phases tied to the
independent audit findings. Each phase lists objectives, deliverables,
success metrics, and dependencies.

**Owner:** Maintainers + sponsor-driven prioritization (see
`/ROADMAP.md#how-we-prioritize`).

**Last updated:** 2026-Q1 — authored alongside the Commercial / Ethical /
Strategic audit remediation (Tasks `com-eth-strat-95`, `sec-legal-95`,
`tech-env-95`).

---

## At a Glance

| Phase | Window | Theme | Tagline |
|---|---|---|---|
| **Phase 2** | Months 4–6 | Arabic-first · Citation 2.0 · Bias auditor · MCP marketplace | "Research that respects language and provenance" |
| **Phase 3** | Months 7–8 | Dual-license · Pricing · Dashboard · API platform | "A sustainable platform, not just a tool" |
| **Phase 4** | Months 9–10 | Multi-region · SOC 2 · Mobile + extension · Real-time collab | "Enterprise-ready, individual-friendly" |

---

## Phase 2 — Months 4–6: *Arabic-first · Citation 2.0 · Bias auditor · MCP marketplace*

### Objectives

1. **Arabic-first UX** — Quaesitor's first users write primarily in Arabic.
   Phase 2 makes Arabic a first-class experience: RTL layout, Arabic
   numerals, hijri dates alongside Gregorian, and an Arabic-tuned system
   prompt for the chat + research agents. The existing i18n strings are
   already keyed by `ar-SA` / `ar-EG`; Phase 2 fills in the gaps and
   promotes Arabic to the default locale for new users in MENA regions
   (geo-detected, user-overridable).

2. **Citation 2.0 (NLI-based)** — the current `citation-verifier.ts` does
   URL-existence checking. Phase 2 upgrades it to Natural Language
   Inference (NLI): for each cited claim, the verifier runs an
   entailment check between the claim and the cited source's excerpt.
   Unverifiable claims (low entailment score) are flagged inline with
   a "needs review" badge. The verifier still falls back to
   URL-existence when no excerpt is available.

3. **`bias_auditor` agent** — a new agent in the swarm that reviews the
   synthesized report for cultural, geographic, and linguistic bias.
   Outputs a per-section bias score + recommendations (e.g. "this
   section draws only from US-based think tanks — consider adding
   sources from the Gulf region"). The agent runs after synthesis but
   before the self-critique pass. Its output is appended to the report
   metadata (not the report body) so users can opt in to viewing it.

4. **MCP marketplace** — a community-driven registry of Model Context
   Protocol servers (Slack, GitHub, Linear, Notion, Google Drive,
   custom internal tools). Users browse, install, and review MCP
   servers from the dashboard. Each MCP server runs in a sandboxed
   subprocess with scoped permissions. The marketplace UI lives at
   `/dashboard/marketplace` (a new page, behind the existing auth gate).

### Deliverables

- [ ] **Arabic-first UX**
  - Complete the `ar-SA` string set in `src/lib/i18n/strings.ts` (currently
    ~70% coverage).
  - Add RTL-aware layout primitives (`<RTLAware>` wrapper, automatic
    `dir="rtl"` on the `<html>` when locale is Arabic).
  - Hijri date formatter alongside Gregorian in the research report
    metadata (`{gregorian: "2026-04-15", hijri: "1447-09-26"}`).
  - Arabic-tuned system prompts: `src/lib/prompts/claude-character.ar.ts`
    with culturally-appropriate register (formal MSA, no dialect mixing
    unless the user explicitly asks).
  - Geo-detection: cloudflare-style `cf-ipcountry` header → default
    locale (MENA countries → Arabic, else English). User-overridable
    via the language toggle.

- [ ] **Citation 2.0 (NLI)**
  - New module `src/lib/citation-nli.ts` — runs an NLI model
    (DeBERTa-v3-base-MNLI via HuggingFace Inference API or local
    ONNX runtime) over (claim, source-excerpt) pairs.
  - Returns `{ entailment: 0..1, contradiction: 0..1, neutral: 0..1 }`
    per cited claim.
  - Integrates into `verifyAllCitations` as a second pass after
    URL-existence. Entailment < 0.5 → flagged with "needs review".
  - Performance budget: ≤ 200ms per claim (batched, cached).

- [ ] **`bias_auditor` agent**
  - New file `src/lib/swarm-agents/bias-auditor.ts`.
  - Runs after `synthesizeReport` completes, before the self-critique pass.
  - Inputs: the report markdown + the source list with `host` + `country`
    metadata (where inferrable from the URL TLD or OpenGraph data).
  - Outputs: per-section bias scores (US-centric, English-language-only,
    Western-academic-skewed) + a remediation list.
  - Surface in the UI as a collapsible "Bias audit" panel under the
    report viewer (default collapsed, opt-in).

- [ ] **MCP marketplace**
  - `src/app/api/mcp-marketplace/route.ts` — list/install/uninstall/review.
  - `src/app/dashboard/marketplace/page.tsx` — browse UI.
  - Sandbox: each MCP server runs in a `bun` subprocess with a
    JSON-RPC stdin/stdout pipe; scoped permissions (filesystem,
    network, env) declared in the server's manifest.
  - Seed the marketplace with 5 official MCP servers (Slack, GitHub,
    Linear, Notion, Google Drive) so it's not empty on launch.

### Success Metrics

- Arabic locale completeness: 70% → 95% (`bun run scripts/i18n-coverage.ts`).
- Citation verifier: 100% of cited claims get an NLI score; ≤ 5% false-positive
  rate (verified by spot-checking 50 reports).
- `bias_auditor` agent: 100% of completed research jobs have a bias audit
  attached; average bias score < 0.4 (1.0 = maximally biased).
- MCP marketplace: ≥ 10 community-published MCP servers by end of Phase 2;
  ≥ 100 installs across the user base.

### Dependencies

- **HuggingFace Inference API** (or local ONNX runtime) for the NLI model.
  Needs `HF_API_TOKEN` env var.
- **`bias_auditor` requires an LLM** — reuses the existing `getLLM()`
  provider chain. No new dependencies.
- **MCP marketplace** needs a review process (manual initially, automated
  reputation scoring later). Depends on the auth system being multi-tenant
  (already done in Task `security-fixes`).
- **Arabic-first** needs the i18n infrastructure already in
  `src/components/i18n/` (LocaleProvider, language-toggle). No new deps.

### Risks

- NLI model latency could bottleneck the synthesis stage. Mitigation:
  run async, cache results by `(claim, source-url)` hash.
- `bias_auditor` could surface false positives that erode user trust in
  the report. Mitigation: clearly label as "audit, not verdict"; users
  can dismiss the panel.
- MCP marketplace is a security surface (third-party code execution).
  Mitigation: sandboxed subprocess + scoped permissions + a manual
  review gate before listing.

---

## Phase 3 — Months 7–8: *Dual-license · Pricing · Dashboard · API platform*

### Objectives

1. **Dual-license enforcement** — the COMMERCIAL_LICENSE.md exists but
   isn't enforced. Phase 3 adds a license check at startup: if the
   deployment is commercial (>50 users OR revenue > $10k/mo), require
   a valid COMMERCIAL_LICENSE_KEY env var. The check is fail-open in
   dev mode (NODE_ENV !== production) and fail-closed in production.
   The license validator lives in `src/lib/license.ts` (already exists
   as a stub — Phase 3 makes it functional).

2. **Pricing** — wire the interactive PricingCalculator (Commercial #1)
   into the checkout flow. Add Stripe Checkout for Pro + Team plans
   (the existing `src/lib/stripe.ts` already supports this — Phase 3
   just exposes it in the UI). Add metered billing for overages
   (research queries + chat messages beyond plan limits).

3. **Dashboard improvements** — the dashboard (Commercial #3) gets:
   - API key generation UI (currently a stub button).
   - Webhook configuration (Stripe events → user-visible activity log).
   - Team management (invite members, assign roles).
   - Export historical usage as CSV.

4. **API platform** — versioned REST API at `/v1/*`. Documented in
   OpenAPI 3.1. TypeScript SDK published to npm as `@quaesitor/sdk`.
   API keys authenticate via `Authorization: Bearer <key>`. Rate
   limits per plan (Free: 10 req/min, Pro: 100 req/min, Team: 1000,
   Enterprise: unlimited).

### Deliverables

- [ ] **Dual-license enforcement**
  - `src/lib/license.ts`: implement `validateCommercialLicense()` —
    RSA signature check against the maintainer's public key.
  - Add a startup check in `src/app/layout.tsx` (server-side) that
    fails-closed in production when `COMMERCIAL_LICENSE_KEY` is missing
    AND the deployment is commercial (heuristic: > 50 users in the
    `users` table OR any active Team/Enterprise subscription).
  - Add a license-status endpoint `GET /api/license/status` (admin-only)
    that returns the current license state + days-to-expiry.

- [ ] **Pricing**
  - `src/app/billing/page.tsx`: list plans, click to checkout (Stripe).
  - `src/lib/stripe.ts`: add metered billing for overages (per-query
    and per-message pricing; usage reports pushed to Stripe nightly).
  - Webhook handler `POST /api/billing/webhook` already exists — extend
    to handle `invoice.payment_failed` (email the user) and
    `customer.subscription.updated` (sync plan to the local
    `subscriptions` table).

- [ ] **Dashboard**
  - `src/app/dashboard/api-keys/page.tsx`: generate, list, revoke API
    keys (stored as SHA-256 hashes; plaintext shown once).
  - `src/app/dashboard/webhooks/page.tsx`: configure webhook URLs for
    Stripe events.
  - `src/app/dashboard/team/page.tsx` (Team+Enterprise only): invite
    members, assign roles (owner/admin/editor/viewer).
  - CSV export of `usage_records` for the current + previous month.

- [ ] **API platform**
  - `src/app/api/v1/chat/route.ts`, `src/app/api/v1/research/route.ts`,
    `src/app/api/v1/documents/route.ts`, `src/app/api/v1/sessions/route.ts`.
  - `docs/api/openapi.yaml` — OpenAPI 3.1 spec, validated with `redocly`.
  - `packages/sdk-ts/` — TypeScript SDK, published to npm.
  - Rate limiter: `src/lib/api-rate-limit.ts` (token bucket per API key,
    plan-tiered).

### Success Metrics

- 100% of commercial deployments have a valid license key (audit
  checklist item — verified manually each quarter).
- ≥ 5 paying Pro subscribers by end of Phase 3.
- ≥ 1 team management seat sold (Team plan).
- API platform: ≥ 100 API keys issued; ≥ 10k requests/month across all
  keys; p95 latency < 800ms for `/v1/chat` (first token).
- OpenAPI spec passes `redocly lint` with 0 errors.

### Dependencies

- **Stripe** (already integrated) — needs `STRIPE_PRO_PRICE_ID` and
  `STRIPE_TEAM_PRICE_ID` env vars set in production.
- **License signing** — maintainer generates an RSA keypair; private key
  stays offline, public key is embedded in `src/lib/license-public-key.pem`.
- **SDK** — needs `openapi-typescript-codegen` (or similar) for codegen.
- **Rate limiter** — reuses the in-memory Map from `src/lib/rate-limit.ts`
  (or upgrades to Redis-backed if REDIS_URL is set).

### Risks

- Stripe webhooks can be flaky; mitigate with retry + idempotency keys.
- API platform exposes a new attack surface; mitigate with strict input
  validation (zod schemas) + per-key rate limits.
- License enforcement could lock out legitimate users if the validator
  has a bug; mitigate with a 7-day grace period + admin override
  (`LICENSE_OVERRIDE=1` env var, audit-logged).

---

## Phase 4 — Months 9–10: *Multi-region · SOC 2 · Mobile app · Browser extension · Real-time collab*

### Objectives

1. **Multi-region deployment** — active-active across 3 regions (us-east-1,
   eu-west-1, ap-southeast-1) with per-workspace region pinning for data
   residency. Cross-region replication for sessions (eventually consistent;
   memories are pinned to the user's home region).

2. **SOC 2 Type II** — kickoff with an external auditor. Close the 4
   High-priority gaps from `legal/SOC2_READINESS.md`:
   - Public status page (hosted on status.quaesitor.dev).
   - SSO (SAML 2.0 + OIDC) for Enterprise.
   - DPIA for memory extraction (now opt-in per Ethical #4).
   - MFA enforced at login (TOTP infrastructure already exists per Task
     `sec-legal-95`; Phase 4 wires it into the NextAuth credentials
     provider).

3. **Mobile app** — React Native (Expo). Talks to a self-hosted
   instance via the v1 REST API. Features: chat, research status
   (push notifications when a job completes), document upload,
   biometric auth (Face ID / fingerprint). Published to TestFlight
   + internal Play Store track.

4. **Browser extension** — Manifest V3, already prototyped in
   `/browser-extension/`. Phase 4 ships it to the Chrome Web Store +
   Firefox Add-ons. Features: right-click "Research this page" /
   "Summarize selection", sidebar chat, page-screenshot → vision.

5. **Real-time collaboration** — Yjs-based CRDT for shared research
   sessions. Multiple users can view + comment on a research report
   in real time. Role-based access (owner / editor / viewer). Cursor
   presence.

### Deliverables

- [ ] **Multi-region**
  - Deploy script: `scripts/deploy-multi-region.sh` — terraform or
    pulmi for the 3 regions.
  - `src/lib/region.ts` — region detection + routing (users in EU →
    eu-west-1, etc).
  - Per-workspace region pinning: `workspace.region` column.
  - Cross-region session replication via Postgres logical replication
    OR a higher-level sync layer (Yjs if the real-time collab work
    overlaps).

- [ ] **SOC 2 Type II**
  - Status page: Next.js app deployed to `status.quaesitor.dev`,
    reading from a separate SQLite/Postgres instance with uptime
    probe data.
  - SSO: `src/lib/sso/saml.ts` + `src/lib/sso/oidc.ts`. New routes
    `POST /api/auth/sso/saml/acs` (Assertion Consumer Service) and
    `GET /api/auth/sso/oidc/callback`.
  - DPIA: `legal/DPIA_MEMORY_EXTRACTION.md` (template + completed
    assessment for the opt-in memory system from Ethical #4).
  - MFA at login: extend `src/app/api/auth/[...nextauth]/route.ts`
    `authorize` callback to require a TOTP after password validation
    when MFA is enabled for the user.

- [ ] **Mobile app**
  - `mobile/` directory at the repo root (Expo project).
  - Screens: chat, research list, research detail, settings.
  - Push notifications via Expo Notifications (FCM + APNs).
  - Biometric auth via `expo-local-authentication`.

- [ ] **Browser extension**
  - Polish the existing `/browser-extension/` MVP.
  - Add the "Research this page" + "Summarize selection" context-menu
    actions.
  - Submit to Chrome Web Store + Firefox Add-ons (review process
    typically 1-2 weeks).

- [ ] **Real-time collaboration**
  - `src/lib/collab/yjs-server.ts` — Yjs WebSocket server (a new
    mini-service in `mini-services/collab-service/`, port 3004).
  - `src/components/collab/SharedReport.tsx` — Yjs-aware report viewer
    with cursor presence.
  - RBAC: extend the auth system with workspace roles.

### Success Metrics

- Multi-region: 99.9% uptime per region; < 200ms p95 cross-region
  replication lag for sessions.
- SOC 2: Type II audit kicked off (target completion: end of Q4 2026).
  All 4 High-priority gaps closed.
- Mobile app: TestFlight + Play Store internal track live; ≥ 50 beta
  users; ≥ 4.0 star rating.
- Browser extension: ≥ 1000 weekly active users across Chrome + Firefox;
  ≥ 4.0 star rating.
- Real-time collab: ≥ 10 concurrent editors per session with < 200ms p95
  cursor latency.

### Dependencies

- **Multi-region**: cloud provider account (AWS/GCP/Azure) with 3 regions.
  Postgres logical replication configured.
- **SOC 2**: external auditor engagement (typical cost $30k-$80k).
  SSO requires SAML/OIDC identity provider (Okta, Azure AD, Google
  Workspace).
- **Mobile app**: Expo account; Apple Developer account ($99/yr); Google
  Play Developer account ($25 one-time).
- **Browser extension**: Chrome Web Store developer account ($5 one-time);
  Firefox Add-ons (free).
- **Real-time collab**: Yjs + a WebSocket server (mini-service). Redis
  optional for cross-region scaling.

### Risks

- Multi-region replication could introduce consistency bugs; mitigate
  with idempotent operations + conflict-free data types (Yjs where
  applicable).
- SOC 2 audit is a 6-12 month process; the "kickoff" milestone in
  Phase 4 is just the start.
- Mobile + browser extension are separate codebases that consume the v1
  API — breaking changes to the API will break both. Mitigate with
  semver discipline (Phase 3 deliverable).
- Real-time collab is a fundamentally different access pattern (long-lived
  WebSocket vs. request/response); mitigate by isolating it in a
  mini-service so it doesn't affect the main API's stability.

---

## Cross-Phase Concerns

These don't fit neatly into a single phase but are tracked across all
three:

- **Security**: every phase includes a security review of new code.
  High-risk additions (MCP marketplace, API platform, SSO, real-time
  collab) get an external pen-test before launch.
- **Accessibility**: WCAG 2.1 AA compliance for all new UI. The
  existing components are largely compliant; new components must
  follow the same patterns (semantic HTML, ARIA, keyboard nav, sr-only
  labels — see `src/components/CookieConsent.tsx` for a reference).
- **Environmental**: every new feature ships with a carbon-impact
  estimate in the PR description (see `docs/ENVIRONMENTAL.md` for the
  methodology). Features that significantly increase CO₂ (e.g. always-on
  real-time collab) need an opt-in / opt-out toggle.
- **Ethical**: memory extraction stays opt-in (Ethical #4). The
  `bias_auditor` agent runs on every research report. Feedback
  collection is anonymous-by-default (Strategic #9 feedback widget
  records userId for spam-prevention but the UI doesn't surface it).
- **Documentation**: every new module ships with a `docs/adr/` entry
  (Architecture Decision Record) explaining the design tradeoffs.

---

## Audit Trail

| Date | Phase | Change | Author |
|---|---|---|---|
| 2026-Q1 | — | Initial v2 roadmap created (tasks com-eth-strat-95, sec-legal-95, tech-env-95) | Maintainers |
| _pending_ | Phase 2 | Arabic-first UX complete | — |
| _pending_ | Phase 2 | Citation 2.0 NLI shipped | — |
| _pending_ | Phase 2 | `bias_auditor` agent shipped | — |
| _pending_ | Phase 2 | MCP marketplace launched | — |
| _pending_ | Phase 3 | Dual-license enforcement live | — |
| _pending_ | Phase 3 | Stripe checkout live | — |
| _pending_ | Phase 3 | API platform v1 shipped | — |
| _pending_ | Phase 4 | Multi-region active-active | — |
| _pending_ | Phase 4 | SOC 2 Type II audit kickoff | — |
| _pending_ | Phase 4 | Mobile app beta | — |
| _pending_ | Phase 4 | Browser extension live | — |
| _pending_ | Phase 4 | Real-time collab GA | — |

---

## Out of Scope for v2

- **Native desktop apps beyond Electron** — Tauri / native macOS is
  not justified; Electron works.
- **Training our own models** — Quaesitor is an integration layer, not
  a model lab.
- **Cryptocurrency / web3** — no plans.
- **A hosted free tier with no limits** — attracts abuse; the Free
  plan stays metered.

These are carried forward from `/ROADMAP.md#what-s-not-on-the-roadmap-yet`
and remain out of scope for v2.
