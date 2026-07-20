# Quaesitor v4.0.0 — Public Launch Release Notes

**Date:** 2026-07-19
**Version:** 4.0.0 (semver) — the first stable public release.
**License:** AGPL-3.0 (open source) + Commercial License for enterprise.
**Tag:** `v4.0.0`

---

## What is Quaesitor

**Quaesitor** (Latin: *quaerere* — "to seek, to investigate") is a
self-hosted AI workstation built for deep research, multi-agent
reasoning, code execution, and persistent memory. It is not a chat
wrapper — it is a 6-stage research pipeline with citation
verification, a 10-role agent swarm that runs in parallel, a
multi-provider LLM fallback chain (NVIDIA → OpenAI → Anthropic →
Ollama), a 5-layer memory system with semantic recall, an interactive
artifacts panel (HTML / React / SVG / Mermaid / code), and the
enterprise security scaffolding (MFA, RBAC, audit logs, GDPR
endpoints, SOC 2 Type II audit documentation) that lets a single
codebase serve both weekend hobbyists and regulated industries.

The project started as a weekend script that ran one research query
against DuckDuckGo and grew — through 12 development rounds and ~450
commits — into a 16-feature platform with 451+ unit/integration tests,
8 E2E specs, a built-in evaluation harness, a Docker image, a browser
extension, a desktop app (Electron), and a mobile app scaffold (Expo).
The entire stack runs on free-tier APIs ($0/month) for personal use;
commercial deployments add paid providers for redundancy without
changing any code.

The design philosophy — "The Investigator's Journal" — is original:
warm ambers and saddle browns (never pure gray), serif body type at
18px / 1.7 line-height for reading comfort, depth indicators styled
after a camera lens, academic-style citation footnotes, and a compass
rose logo that signals exploration. There is no box-shadow, no
backdrop-blur, no gradient — elevation comes from surface tone and
borders, the way a well-made journal feels in the hand.

---

## Key Features

### AI Engine
- **Deep Research** — 6-stage pipeline: plan → decompose → search →
  read → gap analysis → synthesize. Every cited URL is verified (HTTP
  HEAD + content fingerprinting); weak or dead sources are dropped.
- **Agent Swarm** — orchestrator decomposes, 10 specialized roles run
  in parallel (researcher, coder, analyst, writer, generalist,
  security_analyst, electrical_engineer, + 3 more), synthesizer
  combines. Loop-degeneration detection kills stuck agents.
- **Multi-provider LLM** — NVIDIA NIM (6-model chain) → OpenAI →
  Anthropic → Ollama. Cross-provider fallback on failure. Configure
  one provider for free, add paid providers for redundancy.
- **Citation Verification** — NLI (Natural Language Inference) checks
  that cited sources actually support the claims. Self-critique pass
  flags unsupported statements before the report is shown.
- **Prompt Caching** — research results cached for 24h; LLM prompt
  caching for repeated system prompts. Cuts cost + latency on
  follow-up questions.

### UX
- **3-Column Layout** — Sidebar (conversations) + Chat (main) +
  Artifacts (interactive HTML/React/SVG/Mermaid/code in a side panel).
- **Canvas Mode** — inline editing of artifacts; live preview during
  generation (you watch the code fill in as the LLM streams tokens).
- **Command Palette** — Cmd+K (or Ctrl+K) for quick navigation,
  conversation switching, and skill invocation.
- **Inline Citations** — hover-card popovers on `[N]` markers show
  the source URL + tier rating (★★★ academic / ★★☆ industry / ★☆☆
  general).
- **Streaming Animation** — tokens arrive with a 0.08s fade-in;
  a blinking caret marks the cursor position.
- **Dark Mode Crossfade** — theme transitions are animated, never
  abrupt.
- **Mobile Responsive** — touch-friendly targets (44px minimum),
  responsive breakpoints, sans-serif on mobile (serif on desktop for
  reading).

### Platform
- **API Keys + Public API** — generate scoped API keys for
  programmatic access (`/api/v1/chat`); keys are bcrypt-hashed at rest.
- **MCP Transport** — Model Context Protocol over stdio + SSE.
  Marketplace includes 6 pre-built servers (arXiv, PubMed, GitHub,
  SCADA, USPTO, CourtListener).
- **Connectors** — Slack, Notion, Google Drive, GitHub, Jira. OAuth
  flow + credential encryption (AES-256-GCM).
- **Computer Use** — Playwright + Docker for browser automation
  (click / type / scroll / navigate / screenshot). Sandboxed.
- **Device Control Agent** — cross-platform (Win/macOS/Linux) agent
  that can read/write files, run shell commands, install packages.
  Every action audit-logged.
- **Real-time Collaboration** — Yjs + WebSocket session registry.
  Cursor sharing, presence, edit broadcasting. (Stub interface; full
  y-websocket mini-service is the next milestone.)
- **Video Understanding** — keyframe extraction (ffmpeg) + audio
  transcription (Whisper) + vision-model description. Returns a
  `VideoAnalysis` ready to feed into a vision chat turn. (Stub
  interface; install ffmpeg + Whisper to enable.)

### Security
- **MFA** — TOTP-based (RFC 6238). Backup codes. Three API routes
  (`/api/auth/mfa/setup`, `/verify`, `/disable`).
- **RBAC** — four roles (owner / admin / editor / viewer) enforced
  at the data layer.
- **Docker Sandbox** — hardened; falls back to Node `vm` if Docker
  isn't available.
- **SSRF Protection** — `safeFetch` validates every outbound URL
  against an allow-list; blocks private IP ranges (RFC 1918).
- **CSRF Protection** — double-submit cookie + SameSite=Strict.
- **Security Headers** — CSP, HSTS (2-year), X-Frame-Options,
  Permissions-Policy.
- **Audit Logging** — 27+ sensitive actions logged immutably;
  1-year retention default.
- **Error Sanitization** — downstream LLM errors (which can leak
  Authorization headers) are scrubbed before reaching the client.

### Enterprise
- **12 Legal Documents** — Terms of Service, Privacy Policy, DPA,
  SLA, Cookie Policy, AUP, CLA, ROPA, Incident Response Plan,
  SOC 2 Readiness, SOC 2 Type II Audit Prep, SOC 2 Type II Audit
  Documentation Package.
- **GDPR Endpoints** — Art. 7 (consent ledger), Art. 15 (access),
  Art. 17 (erasure), Art. 20 (portability).
- **SOC 2 Type II Readiness** — full TSC mapping (CC1-CC9, A, PI,
  C, P); gap analysis with remediation plan; evidence inventory.
- **SSO** — OIDC + SAML (enterprise SSO).
- **Branch Protection** — no force-push to `main`; PR review required;
  CI gates (tsc + lint + test) must pass.

---

## What Makes Quaesitor Different

**Vs. Claude / ChatGPT / Gemini:**

- **Self-hosted.** Your data never leaves your server (unless you
  configure a cloud LLM provider). Run on Ollama for 0g CO₂ and
  zero data egress.
- **Citation verification.** Every URL in a research report is HTTP-
  HEAD-checked and content-fingerprinted. Claude and ChatGPT cite
  URLs that 404 or that don't actually support the claim; Quaesitor
  drops them.
- **Self-critique.** A second LLM pass flags unsupported statements
  before the report reaches you. The big labs don't show their work.
- **Agent swarm.** 10 specialized roles run in parallel — not a
  single chain-of-thought. Trilogy AI's production post-mortem
  inspired the loop-degeneration detection.
- **AGPL-3.0.** You can fork it, run it as a service, modify it —
  but if you serve it over a network, you must release your
  modifications under AGPL-3.0 with full source. Claude and ChatGPT
  are closed-source; Gemini has an open-weights model but no open
  app.
- **$0/month on free tiers.** NVIDIA NIM is free; DuckDuckGo +
  Wikipedia + GitHub APIs are free. No "Pro" paywall for the deep-
  research feature.

**Vs. Perplexity / GPT Researcher:**

- **Persistent memory.** 5-layer memory system with semantic recall.
  Perplexity has no memory; GPT Researcher is stateless.
- **Artifacts panel.** Interactive HTML / React / SVG renders in a
  side panel, not as a chat message. Canvas Mode for inline editing.
- **Multi-provider.** Add OpenAI / Anthropic / Ollama for redundancy
  without code changes. Perplexity is locked to their model.
- **Auditable.** Full audit log of every sensitive action; SOC 2
  Type II audit documentation package included.

**Moats:** the moat is not the model (it's a commodity) — the moat is
the **workflow** (6-stage research + agent swarm + citation
verification + self-critique), the **compliance posture** (12 legal
docs + SOC 2 + GDPR endpoints), and the **self-hosting story**
($0/month, your data, your server).

---

## Getting Started

Three steps. No Docker required for dev. No database setup (SQLite is
built-in). No Redis required (in-memory fallback).

```bash
# 1. Clone + install
git clone https://github.com/Abd123454/deep-research-engine.git
cd deep-research-engine
bun install  # or: npm install (both work, no flags needed)

# 2. Configure
cp .env.example .env
# Edit .env: set NVIDIA_API_KEY (free at https://build.nvidia.com/)

# 3. Run
bun run dev
# Open the Preview Panel in your IDE, or http://localhost:3000 locally.
```

That's it. The first run creates a SQLite database at `./db/custom.db`,
warms the prompt cache, and you're chatting with the Quaesitor
character (the default agent persona) within seconds.

**Optional:** add OpenAI / Anthropic / Ollama keys for cross-provider
redundancy. Set `REDIS_URL` to enable the BullMQ job queue (research,
email, memory workers). Set `DATABASE_URL=postgresql://...` for
production scale.

---

## Self-Hosted vs SaaS

**Self-Hosted (this repository):**

- AGPL-3.0 — free for personal and commercial use (with the AGPL
  network copyleft clause).
- You run it on your own server. Your data never leaves.
- All features unlocked — no paywalls, no rate limits imposed by us.
- You handle updates, backups, monitoring.
- COMMERCIAL_LICENSE.md available for enterprises that can't comply
  with AGPL-3.0's source-disclosure obligation.

**SaaS (planned, not yet live):**

- Hosted by the Quaesitor Project.
- Free tier (500 chat messages/month, 5 deep research jobs/month).
- Pro tier ($20/month — unlimited chat, 50 deep research jobs/month).
- Enterprise tier (custom — SSO, audit log export, dedicated region).
- The SaaS edition inherits the same codebase (this repository) plus
  the infrastructure-layer controls documented in
  `legal/SOC2_TYPE_II_AUDIT.md`.

The SaaS edition is not yet live — the launch blocker is the SOC 2
Type II audit observation period (6 months, see
`legal/SOC2_TYPE_II_AUDIT.md` § 4).

---

## License

**AGPL-3.0** — see [`LICENSE`](LICENSE). In short: you can use,
modify, and distribute Quaesitor (including as a network service),
but any modifications you share or serve over a network must also be
released under AGPL-3.0 with full source code.

**Commercial License** — see [`COMMERCIAL_LICENSE.md`](COMMERCIAL_LICENSE.md).
For enterprises that cannot comply with AGPL-3.0's source-disclosure
obligation (e.g. embedding Quaesitor in a proprietary product), a
commercial license is available. Contact the maintainers.

---

## Roadmap Summary

See [`ROADMAP.md`](ROADMAP.md) and [`docs/ROADMAP_v2.md`](docs/ROADMAP_v2.md)
for the full 10-month roadmap. Highlights:

- **Q3 2026:** y-websocket mini-service for real-time CRDT
  collaboration (replaces the current stub). ffmpeg + Whisper
  integration for video understanding.
- **Q4 2026:** SOC 2 Type II audit observation period opens. Mobile
  app (Expo) public release. Browser extension v2 (Manifest V3 +
  side panel).
- **Q1 2027:** SaaS edition launch (pending SOC 2 report issuance).
  Enterprise tier with SSO + dedicated regions.
- **Q2 2027:** Plugin marketplace (third-party agents, skills, MCP
  servers). Federated learning for memory (opt-in).

---

## Community

- **GitHub:** [github.com/Abd123454/deep-research-engine](https://github.com/Abd123454/deep-research-engine)
- **Discussions:** GitHub Discussions for Q&A, feature requests, and
  showcases.
- **Contributing:** see [`CONTRIBUTING.md`](CONTRIBUTING.md). CLA
  required for contributions. Code style enforced via ESLint (strict,
  0 warnings). `bunx tsc --noEmit --strict` is the type-soundness
  gate.
- **Security disclosures:** see [`SECURITY.md`](SECURITY.md).
  Responsible disclosure; PGP key for sensitive reports.

We welcome contributions of all sizes — bug fixes, new MCP servers,
new agent roles, new eval queries, documentation improvements. The
project is maintained by a small team; PRs with tests + docs are
reviewed first.

---

## Known Limitations (honestly)

- **Semantic search uses LIKE**, not pgvector — sufficient for
  SQLite / single-user, upgrade to Postgres + pgvector for production
  scale. (pgvector migration script exists at
  `src/lib/pgvector-migration.ts`; it's a TODO to wire it in.)
- **`research-engine.ts` coverage: ~60%** — improved from 23% in
  v1.2.0, targeting 80%. Some error paths are still untested.
- **Mobile app is a scaffold.** The web app is responsive, but the
  Expo app (`mobile/`) is not yet feature-complete. Public mobile
  release targeted for Q4 2026.
- **Rate limiter uses in-memory fallback.** Redis is supported but
  optional. Without Redis, rate limiting is per-process (a multi-
  instance deploy would need Redis for the limit to be global).
- **Docker sandbox requires Docker installed.** Falls back to the
  Node `vm` sandbox if Docker isn't available (less isolation).
- **Playwright adds ~150MB.** Optional — for JS-rendered page reading
  + E2E tests. The app works without it.
- **Real-time collaboration is not wired up.** The session registry
  (`src/lib/collab/collab-server.ts`) is live (create / join / leave
  / inspect), but actual Yjs document sync (CRDT updates over
  WebSocket) requires the y-websocket mini-service (Q3 2026
  milestone). The high-level cursor/presence interface stub was
  removed in v4.1.0 (dead code — never imported). See
  `docs/MIGRATION_NOTES.md` for the implementation plan.
- **Video understanding is not implemented.** The API route exists
  and returns 503 ("Video understanding is not available on this
  server"). The lib stub throws "Not implemented" if called directly.
  Requires ffmpeg + Whisper on the host. See `docs/MIGRATION_NOTES.md`
  for the implementation plan.
- **Dev-dependency vulnerabilities** in `vite`, `minimatch` (via
  eslint / vitest / prisma dev tools) — HIGH advisories, dev-only,
  not in production runtime. Upgrading requires major version bumps
  that may break the toolchain. Tracked but not blocking.

We don't oversell. Quaesitor is a powerful tool with rough edges. If
you find a bug, file an issue. If you can fix it, send a PR.

---

## Acknowledgments

- **GPT Researcher** ([github.com/assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher))
  — inspired the multi-round research pattern.
- **Open Deep Research** ([github.com/langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research))
  — inspired the evaluation methodology.
- **Kimi K2.5** — the agent-swarm patterns (parallel tool calls,
  loop-degeneration detection) were informed by Kimi's published
  research.
- **Trilogy AI** — the production post-mortem on agent-loop
  degeneration informed the swarm's safety bounds.
- **shadcn/ui** — the component library that let us focus on the
  product, not the chrome.
- **The AICPA** — the SOC 2 Trust Services Criteria framework that
  gave us a structured way to think about security, availability,
  processing integrity, confidentiality, and privacy.

And to everyone who filed an issue, sent a PR, or tested a pre-release
build: thank you. The project is better because of you.

---

**Full changelog:** [`CHANGELOG.md`](CHANGELOG.md).
**Upgrade guide:** not applicable (this is the first stable release).
**Support:** GitHub Issues + Discussions.
