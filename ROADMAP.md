# Quaesitor Roadmap

This document outlines the public development roadmap for Quaesitor. It is a living plan — priorities shift based on user feedback, security needs, and what's actually possible with the time and resources we have. Dates are quarterly targets, not hard commitments.

If a feature you care about isn't here, open a [Feature Request](https://github.com/Abd123454/deep-research-engine/issues/new?template=feature_request.md) and make the case.

---

## At a Glance

| Quarter | Theme | Tagline |
|---|---|---|
| **Q1 2026** | Beta | Multi-modal, self-hosted, local-first |
| **Q2 2026** | Stable | Plugin marketplace, public API, mobile + extension |
| **Q3 2026** | Scale | Multi-region, compliance, connectors, real-time |
| **Q4 2026** | Platform | Developer ecosystem, white-label, FederalRAMP |

---

## Q1 2026 — Current (Beta): *Multi-modal · Self-hosted · Local-first*

The focus this quarter is turning the experimental workstation into a usable beta: multimodal inputs (vision + voice + documents), rock-solid self-hosting, transparent pricing, and a real local-first story.

### Themes
- **Multi-modal**: first-class vision, voice (TTS + ASR), document QA, and file generation (PDF/DOCX/PPTX/XLSX) wired into every mode.
- **Self-hosted**: one-command Docker deploy, a hardened Caddy reverse proxy config, and a documented bare-metal path.
- **Pricing**: a transparent tier table (Free / Pro / Team), Stripe checkout + portal, usage tracking, and a free-forever tier that runs on $0/month.
- **Local-first**: SQLite as the default, optional Postgres for scale, optional Ollama for fully offline LLMs, and a PWA that keeps working when the network drops.

### Milestones
- [ ] Vision pipeline with 4-provider fallback (OpenAI → Anthropic → NVIDIA → Tesseract OCR).
- [ ] Voice: streaming TTS and ASR with browser fallbacks.
- [ ] Document QA: upload, parse, embed, and chat with citations.
- [ ] File generation: PDF, DOCX, PPTX, XLSX export from chat.
- [ ] Stripe billing: checkout, webhook, portal, usage metering.
- [ ] Docker Compose stack with Caddy + Postgres + Redis (optional).
- [ ] PWA: installable, offline indicator, service worker caching.
- [ ] Evaluation harness: 20-query suite with automated scoring.
- [ ] Security hardening: prompt-injection defense, CORS, rate limiting, file upload validation.

### Definition of Done for Beta
- `bun run test` passes with >= 80% coverage on `src/lib/research-engine.ts`.
- All 8 Playwright E2E tests pass on a fresh `bun run dev`.
- `docker compose up -d` produces a working instance with no manual steps.
- README + EVAL.md published with baseline results.

---

## Q2 2026 — Stable: *Plugin Marketplace · Public API · Mobile + Extension*

With beta validated by real users, we lock the public surface area: a plugin marketplace, a versioned public API, and first-class mobile + browser-extension experiences.

### Themes
- **Plugin Marketplace**: a registry of community plugins (skills, connectors, model adapters) with install/uninstall, versioning, and a review process.
- **Public API**: a versioned REST + streaming API documented in OpenAPI, with API keys, rate limits, and an SDK (TypeScript first, Python second).
- **Mobile App**: a React Native (Expo) app that talks to a self-hosted instance — chat, research status, push notifications.
- **Browser Extension**: ship the existing Manifest V3 extension to the Chrome and Firefox stores; add right-click "Research this page" + "Summarize selection".

### Milestones
- [ ] Plugin manifest schema v1 (`quaesitor.plugin.json`).
- [ ] Marketplace UI: browse, search, install, review, report.
- [ ] Plugin sandbox: isolated execution, scoped permissions, audit log.
- [ ] Public API v1: `/v1/chat`, `/v1/research`, `/v1/documents`, `/v1/sessions`.
- [ ] OpenAPI 3.1 spec published at `/docs/api/openapi.yaml` and on the website.
- [ ] TypeScript SDK (`@quaesitor/sdk`) published to npm.
- [ ] Python SDK (`quaesitor`) published to PyPI.
- [ ] React Native mobile app: chat, research, push notifications, biometric auth.
- [ ] Browser extension v1.0 published to Chrome Web Store + Firefox Add-ons.
- [ ] API key management UI with usage dashboards.

### Definition of Done for Stable
- Semver guarantees: no breaking changes within a major version.
- Marketplace has >= 10 community plugins at launch.
- Mobile app is in TestFlight + internal Play Store track.
- Public API has 95th percentile latency < 800ms for chat (streaming first token).

---

## Q3 2026 — Scale: *Multi-region · SOC 2 · Connectors Marketplace · Real-time Collaboration*

Now that the surface area is stable, we scale it up for teams and regulated industries.

### Themes
- **Multi-region**: deploy across regions (US, EU, AP) with data residency controls and cross-region replication for sessions.
- **SOC 2 Type II**: complete the audit. Data encryption at rest, audit logging, access reviews, incident response runbooks.
- **Connectors Marketplace**: native integrations with Slack, Notion, Google Drive, GitHub, Jira, Linear, Confluence — bidirectional sync where it makes sense.
- **Real-time Collaboration**: shared research sessions with live cursors, comments, and role-based access (owner / editor / viewer).

### Milestones
- [ ] Multi-region deployment: active-active in us-east-1, eu-west-1, ap-southeast-1.
- [ ] Data residency controls: per-workspace region pinning.
- [ ] SOC 2 Type II audit kickoff with an external auditor.
- [ ] Audit log: every read/write of sensitive data recorded and exportable.
- [ ] Connectors SDK + at least 6 native connectors (Slack, Notion, Drive, GitHub, Jira, Linear).
- [ ] Real-time collaboration: Yjs or CRDT-based session sharing.
- [ ] RBAC: owner / admin / editor / viewer roles per workspace.
- [ ] SSO: SAML 2.0 + OIDC for enterprise.
- [ ] Backup + disaster recovery: point-in-time recovery, documented RTO/RPO.

### Definition of Done for Scale
- SOC 2 Type II report published (or in remediation with a clear timeline).
- Connectors marketplace has >= 10 connectors.
- Real-time collaboration supports >= 10 concurrent editors per session with < 200ms p95 cursor latency.
- 99.9% uptime SLA available to Pro and Team plans.

---

## Q4 2026 — Platform: *Developer Ecosystem · Skill Creator Studio · White-label · FederalRAMP*

The final quarter of 2026 turns Quaesitor from a product into a platform that other people build on.

### Themes
- **Developer Ecosystem**: first-class CLI, local plugin development with hot reload, a typeshare layer so SDKs auto-generate from the OpenAPI spec, and a public changelog feed.
- **Skill Creator Studio**: a visual builder for skills — define inputs, outputs, prompts, and tool calls in a no-code UI; export as a plugin.
- **White-label**: theming, custom branding, custom domains, and a hosted offering for organizations that want Quaesitor without the ops.
- **FederalRAMP**: begin the FedRAMP Moderate authorization process — SCUBA-aligned controls, an isolated govcloud deployment, and a system security plan (SSP).

### Milestones
- [ ] Quaesitor CLI (`quaesitor`): init, dev, build, publish, deploy from the terminal.
- [ ] Plugin dev server with hot reload and in-browser debugger.
- [ ] Auto-generated SDKs (TypeScript, Python, Go, Rust) from OpenAPI.
- [ ] Skill Creator Studio: drag-and-drop skill builder with live preview.
- [ ] White-label: theme tokens, logo upload, custom domain, CSS overrides.
- [ ] Hosted offering: managed Quaesitor at `app.quaesitor.dev` (free tier + paid tiers).
- [ ] FedRAMP Moderate SSP drafted.
- [ ] GovCloud deployment: isolated tenancy, FIPS-validated crypto.
- [ ] Public status page + incident history.
- [ ] Annual security audit cadence established.

### Definition of Done for Platform
- CLI is on Homebrew, Scoop, and `npm install -g`.
- Skill Creator Studio can produce and publish a plugin end-to-end without touching code.
- White-label is GA with >= 5 launch partners.
- FedRAMP authorization is in progress with a named 3PAO.

---

## How We Prioritize

The roadmap is shaped by:

1. **User feedback** — issues, discussions, and direct email. Volume and severity both matter.
2. **Maintainer capacity** — what the active maintainers can realistically review and merge.
3. **Funding** — sponsored features get priority; see [FUNDING.yml](.github/FUNDING.yml).
4. **Technical debt** — we reserve ~20% of each quarter for refactors, dependency upgrades, and security work.

If you want to accelerate a specific item, the fastest way is to either (a) submit a PR, or (b) sponsor the work. Reach out via GitHub Discussions to coordinate.

---

## What's Not on the Roadmap (Yet)

A few things we've considered but aren't committing to:

- **Native desktop apps beyond Electron** (Tauri, native macOS) — Electron works, the bundle size is the only real complaint.
- **Training our own models** — we're an integration layer, not a model lab. The provider landscape moves too fast to bet on a single fine-tune.
- **Cryptocurrency / web3 features** — no plans.
- **A hosted free tier with no limits** — we have a generous free tier, but unmetered hosting attracts abuse and would crowd out paying users.

If you feel strongly about any of these, open a discussion and we'll revisit.

---

## Changelog

Significant roadmap changes are recorded in [CHANGELOG.md](CHANGELOG.md) under the `roadmap` category. The roadmap itself is versioned by git history — diff `ROADMAP.md` between tags to see what shifted.

---

## Acknowledgments

This roadmap exists because users told us what they needed. Thank you to everyone who has filed an issue, opened a discussion, or sent a kind word. You're the reason we keep going.
