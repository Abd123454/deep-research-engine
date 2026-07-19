# SOC 2 Type II Audit Documentation Package

> **Status.** This is a **documentation package for a future SOC 2 Type II
> audit engagement** — not an actual audit report. A SOC 2 Type II report
> can only be issued by an independent third-party auditor (CPA firm)
> after a formal engagement that includes a 6–12 month observation
> period of operating effectiveness. This package collects and maps the
> evidence an auditor would need, identifies gaps, and serves as the
> baseline against which the audit firm will test.
>
> **Relationship to other documents.**
> - `legal/SOC2_READINESS.md` — gap analysis (what's missing before an
>   audit can be commissioned).
> - `legal/SOC2_TYPEII_AUDIT_PREP.md` — control-by-control evidence
>   mapping (what's already in place, where the proof lives).
> - **This document** (`legal/SOC2_TYPE_II_AUDIT.md`) — the integrated
>   package an auditor receives at engagement kickoff: criteria
>   mapping + evidence inventory + gap analysis + remediation plan.

**Version:** 1.0
**Last updated:** 2026-07-19
**Issuer:** Quaesitor Project
**Scope:** Quaesitor SaaS Edition. Self-hosted deployments inherit
the application-layer controls documented here; operators are
responsible for their own infrastructure-layer controls (physical
security, hosting provider SLAs, HR procedures).
**Audit window targeted:** 6 months from green-light (gap-closure
complete) → 6-month observation period → report issuance.

---

## 1. Trust Services Criteria Mapping

The AICPA Trust Services Criteria (TSC) organize controls into five
categories. **Security** (Common Criteria, CC1–CC9) is mandatory for
every engagement; the other four (Availability, Processing Integrity,
Confidentiality, Privacy) are optional but Quaesitor targets all five
to support enterprise customers in regulated industries.

For each criterion below, the mapping lists:
- **Control** — what Quaesitor does.
- **Evidence** — where the proof lives (file path, table, log source).
- **Frequency** — how often the control operates.
- **Owner** — accountable team.

### 1.1 Security (Common Criteria — CC1 through CC9)

#### CC1 — Control Environment

**CC1.1 — Control Environment & Organizational Structure**

- **Control:** Documented governance model with designated maintainers
  per subsystem (research engine, billing, auth, connectors). RBAC with
  four roles (owner / admin / editor / viewer) enforced at the data
  layer.
- **Evidence:** `src/lib/rbac.ts`, `workspace_members` table,
  `docs/adr/0002-agent-cluster-design.md` (governance model).
- **Frequency:** Continuous.
- **Owner:** Engineering.

**CC1.2 — Board Oversight**

- **Self-hosted OSS:** N/A (no board).
- **SaaS Edition:** A formal board charter and oversight cadence will
  be established before the audit window opens. **Gap.**

**CC1.3 — Organizational Structure**

- **Control:** Documented team structure with separation of duties
  (engineering, operations, security). Code review enforces the
  "no unreviewed merge to main" rule via GitHub branch protection.
- **Evidence:** GitHub branch protection settings; `CONTRIBUTING.md`
  (reviewer model).
- **Frequency:** Continuous.
- **Owner:** Engineering.

**CC1.4 — Commitment to Competence**

- **Control:** `CONTRIBUTING.md` documents the contribution workflow;
  CLA required for all contributions; ESLint strict config enforces
  code style (0 warnings allowed); `bunx tsc --noEmit --strict` is
  the type-soundness gate.
- **Evidence:** `CONTRIBUTING.md`, `legal/CLA.md`, `eslint.config.mjs`,
  `tsconfig.json` (`"strict": true`), CI pipeline.
- **Frequency:** Continuous.
- **Owner:** Engineering.

**CC1.5 — Enforcement of Accountability**

- **Control:** Audit logging for 27+ sensitive actions
  (`SENSITIVE_ACTIONS` map in `src/lib/audit.ts`). Audit entries are
  anonymized on account deletion (GDPR Art. 17) but the audit trail
  of WHAT happened is retained.
- **Evidence:** `src/lib/audit.ts`, `audit_logs` table,
  `src/app/api/account/route.ts` (anonymization on delete).
- **Frequency:** Continuous.
- **Owner:** Engineering / Security.

#### CC2 — Communication and Information

**CC2.1 — External Communication**

- **Control:** 12 legal documents in `/legal/` cover the full
  subscriber lifecycle: Terms of Service, Privacy Policy, DPA, SLA,
  Cookie Policy, AUP, CLA, ROPA, Incident Response Plan, SOC 2
  Readiness, SOC 2 Type II Audit Prep, and this document.
- **Evidence:** `legal/` directory.
- **Frequency:** Reviewed quarterly.
- **Owner:** Engineering / Legal.

**CC2.2 — Internal Communication**

- **Control:** `CHANGELOG.md` documents every release; structured
  logging via `pino` (`src/lib/logger.ts`) feeds a central log
  aggregator; GitHub Issues and PRs are the canonical change channel.
- **Evidence:** `CHANGELOG.md`, `src/lib/logger.ts`, GitHub history.
- **Frequency:** Continuous.
- **Owner:** Engineering.

**CC2.3 — System Design Documentation**

- **Control:** ADRs in `/docs/adr/` document security trade-offs
  (dual-mode database, agent cluster design, cross-provider fallback,
  5-layer memory system). `DESIGN.md` codifies the visual design.
- **Evidence:** `docs/adr/0001-dual-mode-database.md`,
  `docs/adr/0002-agent-cluster-design.md`,
  `docs/adr/0003-cross-provider-llm-fallback.md`,
  `docs/adr/0004-memory-system-5-layers.md`, `DESIGN.md`.
- **Frequency:** Updated per architectural change.
- **Owner:** Engineering.

#### CC3 — Risk Assessment

**CC3.1 — Annual Risk Assessment**

- **Control:** Annual risk assessment covering threat modeling,
  vendor risk, regulatory changes, and incident post-mortems.
  Findings flow into the backlog with severity labels.
- **Evidence:** `agent-ctx/deep-security-audit.md`,
  `agent-ctx/security-hardening.md`, `agent-ctx/fix-5-critical-pdf.md`,
  `agent-ctx/sec-legal-95.md` — these are the risk-assessment
  artifacts that drove the 2026 hardening wave.
- **Frequency:** Annual + ad-hoc (after major incidents).
- **Owner:** Security.

**CC3.2 — Identified Risks & Mitigations**

- **Control:** Risks identified in the deep-security-audit were
  triaged by CVSS and remediated. Examples: NEXTAUTH_SECRET hardcoded
  default (C-1, CVSS 9.8 → fixed), verification-token forgery (C-2,
  CVSS 9.1 → fixed), XSS via artifacts (C-5, CVSS 8.1 → DOMPurify).
- **Evidence:** `agent-ctx/fix-5-critical-pdf.md` (remediation record),
  `src/lib/verification-tokens.ts`, `src/components/artifacts/ArtifactsPanel.tsx`.
- **Frequency:** Continuous (per-finding).
- **Owner:** Security / Engineering.

**CC3.3 — Fraud Risk**

- **Control:** Billing fraud mitigated by Stripe webhook signature
  verification + idempotency keys; subscription state is reconciled
  against the Stripe source of truth on every billing endpoint.
- **Evidence:** `src/app/api/billing/webhook/route.ts`,
  `src/lib/stripe.ts`.
- **Frequency:** Continuous.
- **Owner:** Engineering.

#### CC4 — Monitoring Activities

**CC4.1 — Continuous Monitoring**

- **Control:** Sentry captures runtime errors
  (`sentry.server.config.ts`, `sentry.edge.config.ts`,
  `sentry.client.config.ts`). `/api/health` exposes a liveness
  endpoint. `/api/metrics` exposes Prometheus-style metrics. Audit
  logs are queryable via `/api/audit-logs`.
- **Evidence:** Sentry config files, `src/app/api/health/route.ts`,
  `src/app/api/metrics/route.ts`, `src/app/api/audit-logs/route.ts`.
- **Frequency:** Continuous.
- **Owner:** Operations / Security.

**CC4.2 — Internal Audit**

- **Control:** Pre-merge CI runs `bunx tsc --noEmit --strict` +
  `bun run lint` + `bun run test` (451+ tests). Failures block merge.
- **Evidence:** CI workflow, `vitest.config.ts`, `package.json`
  scripts.
- **Frequency:** Per-PR.
- **Owner:** Engineering.

**CC4.3 — External Assessments**

- **Control:** Dependency vulnerability scanning via `bun audit`.
  Playwright E2E suite covers 8 critical user journeys. Periodic
  external penetration tests are commissioned annually.
- **Evidence:** `bun.lock` (lockfile), `e2e/` directory, dependency
  advisories.
- **Frequency:** Continuous (deps) / annual (pentest).
- **Owner:** Security.

#### CC5 — Control Activities

**CC5.1 — Access Controls**

- **Control:** `requireAuth` middleware on every sensitive endpoint.
  `getUserId(req)` resolves the caller from NextAuth v4. `AUTH_DEV_BYPASS=1`
  is the explicit opt-in for dev-mode auth bypass (was implicit before
  the C-4 fix).
- **Evidence:** `src/lib/auth.ts`, `src/app/api/**/route.ts` (all
  sensitive routes call `requireAuth`).
- **Frequency:** Continuous.
- **Owner:** Engineering.

**CC5.2 — Change Management**

- **Control:** Branch protection on `main`; PR review required; CI
  gates (tsc + lint + test); semantic-versioned releases (`vX.Y.Z`
  tags); `CHANGELOG.md` records every change.
- **Evidence:** GitHub branch protection, `CHANGELOG.md`, CI workflow.
- **Frequency:** Per-PR / per-release.
- **Owner:** Engineering.

**CC5.3 — Data Disposal**

- **Control:** Account deletion (`DELETE /api/account`) anonymizes
  PII while preserving the audit trail (GDPR Art. 17). Verification
  tokens are pruned via `pruneVerificationTokens()`. Memory
  export/deletion endpoints enforce the user's right to erasure.
- **Evidence:** `src/app/api/account/route.ts`,
  `src/lib/verification-tokens.ts`,
  `src/app/api/memories/[id]/route.ts`.
- **Frequency:** Continuous.
- **Owner:** Engineering.

#### CC6 — Logical and Physical Access Controls

**CC6.1 — Logical Access (MFA + RBAC)**

- **Control:** TOTP-based MFA (RFC 6238) via `/api/auth/mfa/*`.
  RBAC with 4 roles enforced at the data layer. API keys use a
  `qaesitor_••••` prefix (display only); the full key is bcrypt-hashed
  at rest.
- **Evidence:** `src/lib/mfa.ts`, `src/lib/rbac.ts`,
  `src/app/api/keys/route.ts`, `src/lib/credentials.ts`.
- **Frequency:** Continuous.
- **Owner:** Engineering / Security.

**CC6.2 — Audit Logs**

- **Control:** 27+ sensitive actions logged via
  `logSensitiveAction()`; audit log entries are immutable (no UPDATE
  or DELETE on `audit_logs`); 1-year retention default.
- **Evidence:** `src/lib/audit.ts` (`SENSITIVE_ACTIONS` map),
  `audit_logs` table, `src/app/api/audit-logs/route.ts`.
- **Frequency:** Continuous.
- **Owner:** Security.

**CC6.3 — Physical Security**

- **Self-hosted OSS:** N/A (operator's responsibility).
- **SaaS Edition:** Hosting provider (AWS / GCP) physical security
  inherited — the provider's SOC 2 Type II report covers data-center
  controls. **Evidence:** provider's SOC 2 report (obtained under
  NDA at engagement kickoff).

#### CC7 — System Operations

**CC7.1 — Incident Response**

- **Control:** `legal/INCIDENT_RESPONSE_PLAN.md` defines severity
  levels, on-call rotation, communication templates, and the 72-hour
  breach-notification timeline (GDPR Art. 33). Sentry alerts page
  on-call; runbooks are linked from the IR plan.
- **Evidence:** `legal/INCIDENT_RESPONSE_PLAN.md`, Sentry alert
  rules, on-call schedule.
- **Frequency:** Per-incident.
- **Owner:** Security / Operations.

**CC7.2 — Backup & Disaster Recovery**

- **Control:** `scripts/backup.sh` performs daily Postgres backups
  to object storage (S3-compatible) with 30-day retention. RPO = 24h,
  RTO = 4h. The DR runbook documents regional failover.
- **Evidence:** `scripts/backup.sh`, `docker-compose.yml`
  (defines the production topology), DR runbook (internal).
- **Frequency:** Daily backups / quarterly DR drill.
- **Owner:** Operations.

**CC7.3 — System Monitoring**

- **Control:** `/api/health` (liveness), `/api/metrics` (Prometheus),
  Sentry (errors), `pino` structured logs (operations). Rate-limit
  metrics are exposed for capacity planning.
- **Evidence:** `src/app/api/health/route.ts`,
  `src/app/api/metrics/route.ts`, `src/lib/rate-limit.ts`,
  `src/lib/logger.ts`.
- **Frequency:** Continuous.
- **Owner:** Operations.

#### CC8 — Change Management

**CC8.1 — Code Review**

- **Control:** Every PR requires at least one approval from a
  maintainer. CI gates (tsc + lint + test) must pass. Force-push to
  `main` is disabled.
- **Evidence:** GitHub branch protection rules, PR review history.
- **Frequency:** Per-PR.
- **Owner:** Engineering.

**CC8.2 — CI/CD Pipeline**

- **Control:** GitHub Actions runs lint → tsc → test → build →
  deploy. Deployment is gated on all four passing. Rollback is
  `git revert` + redeploy.
- **Evidence:** `.github/workflows/ci.yml` (CI config),
  `package.json` scripts.
- **Frequency:** Per-PR / per-deploy.
- **Owner:** Engineering / Operations.

**CC8.3 — Deployment Process**

- **Control:** Deployments are atomic (Next.js build → atomic swap
  of the running process). Health-check before traffic switch.
  Feature flags gate user-visible changes.
- **Evidence:** `Dockerfile`, `docker-compose.yml`, deploy runbook.
- **Frequency:** Per-deploy.
- **Owner:** Operations.

#### CC9 — Risk Mitigation

**CC9.1 — Vendor Management**

- **Control:** Sub-processors are listed in the Privacy Policy and
  DPA. Each sub-processor's SOC 2 report is reviewed annually.
  Vendor risk assessment covers data access, location, breach history.
- **Evidence:** `legal/PRIVACY_POLICY.md` (sub-processor list),
  `legal/DATA_PROCESSING_AGREEMENT.md`, vendor SOC 2 reports (under
  NDA).
- **Frequency:** Annual.
- **Owner:** Security / Legal.

**CC9.2 — Business Continuity**

- **Control:** Multi-provider LLM fallback (NVIDIA → OpenAI →
  Anthropic → Ollama) ensures the service degrades gracefully if one
  provider is down. Cross-region failover documented in the DR
  runbook.
- **Evidence:** `src/lib/llm-provider.ts` (fallback chain),
  `docs/adr/0003-cross-provider-llm-fallback.md`.
- **Frequency:** Continuous.
- **Owner:** Engineering / Operations.

### 1.2 Availability

**A1.1 — Environmental Protections**

- **Control:** Hosting provider (AWS / GCP) provides environmental
  protections (power, cooling, fire suppression) under their SOC 2
  Type II report. The Quaesitor service inherits these.
- **Evidence:** Provider's SOC 2 report (under NDA).
- **Frequency:** Inherited.
- **Owner:** Operations.

**A1.2 — Availability Objectives**

- **Control:** 99.5% uptime target documented in `legal/SLA.md`.
  Monitoring via `/api/health` (liveness) + Sentry (errors). The SLA
  defines service credits for missed uptime.
- **Evidence:** `legal/SLA.md`, `/api/health` uptime metrics.
- **Frequency:** Continuous.
- **Owner:** Operations.

**A1.3 — Capacity Planning**

- **Control:** Rate limiting (`src/lib/rate-limit.ts`) protects
  against traffic spikes. Redis-backed rate limiting in production
  (in-memory fallback for dev). Capacity reviewed monthly.
- **Evidence:** `src/lib/rate-limit.ts`, monthly capacity review
  notes.
- **Frequency:** Monthly.
- **Owner:** Operations.

### 1.3 Processing Integrity

**PI1.1 — Processing Authorized**

- **Control:** User consent captured in the `consent_ledger` table
  (GDPR Art. 7). Memory extraction requires explicit opt-in
  (`memoryExtraction` consent key); explicit "remember that…"
  commands are treated as single-event consent.
- **Evidence:** `src/lib/consent.ts`, `consent_ledger` table,
  `src/app/api/consent/route.ts`.
- **Frequency:** Continuous.
- **Owner:** Engineering / Legal.

**PI1.2 — Data Minimization**

- **Control:** PII collection is scoped to what's required for the
  service (email, hashed password; no demographic data). Memory
  extraction uses a deny-list (`src/lib/memory-extractor.ts`) to skip
  sensitive patterns (credit cards, SSNs, API keys).
- **Evidence:** `prisma/schema.prisma` (User model — minimal fields),
  `src/lib/memory-extractor.ts`.
- **Frequency:** Continuous.
- **Owner:** Engineering.

**PI2.1 — Citation Verification (Processing Complete)**

- **Control:** Research reports run every cited URL through
  `citation-verifier.ts` (HTTP HEAD + content fingerprinting). Weak
  or dead citations are dropped before the report is finalized.
- **Evidence:** `src/lib/citation-verifier.ts`,
  `src/lib/__tests__/citation-verifier.test.ts` (19 tests).
- **Frequency:** Per-research-job.
- **Owner:** Engineering.

**PI2.2 — Self-Critique Loop**

- **Control:** Research synthesis runs a self-critique pass
  (`src/lib/prompts/self-critique.ts`) that flags unsupported claims
  and overstatements before the report is shown to the user.
- **Evidence:** `src/lib/prompts/self-critique.ts`,
  `src/lib/critical-thinking.ts`.
- **Frequency:** Per-research-job.
- **Owner:** Engineering.

### 1.4 Confidentiality

**C1.1 — Confidential Information Identified**

- **Control:** Data classification: public (legal docs, README),
  internal (ADRs, eval results), confidential (user PII, audit logs),
  restricted (API keys, secrets). Classification drives handling
  rules.
- **Evidence:** `SECURITY.md` (data classification section),
  `legal/ROPA.md` (Record of Processing Activities).
- **Frequency:** Reviewed annually.
- **Owner:** Security / Legal.

**C1.2 — Confidential Information Protected**

- **Control:** AES-256-GCM encryption at rest for credentials
  (`src/lib/credentials.ts`). TLS 1.2+ in transit (enforced by
  hosting provider). API keys bcrypt-hashed. Database connection
  string in env vars (never in code).
- **Evidence:** `src/lib/credentials.ts`, `src/lib/csrf.ts`
  (CSRF tokens), `next.config.ts` (HSTS + CSP headers).
- **Frequency:** Continuous.
- **Owner:** Engineering / Security.

**C2.1 — Encryption Key Management**

- **Control:** `NEXTAUTH_SECRET` (JWT signing) must be set in
  production — the module throws at import time if missing. The
  encryption key for credentials (`CREDENTIALS_ENCRYPTION_KEY`) is
  loaded from env, never logged.
- **Evidence:** `src/app/api/auth/[...nextauth]/route.ts` (C-1 fix),
  `src/lib/credentials.ts`.
- **Frequency:** Continuous.
- **Owner:** Security.

### 1.5 Privacy

**P1.1 — Privacy Notice**

- **Control:** `legal/PRIVACY_POLICY.md` is GDPR- and CCPA-compliant,
  covering: categories of data collected, purposes, legal bases,
  retention periods, third-party recipients, user rights, and contact
  information for the DPO.
- **Evidence:** `legal/PRIVACY_POLICY.md`, `legal/COOKIE_POLICY.md`.
- **Frequency:** Reviewed annually + on regulatory change.
- **Owner:** Legal.

**P2.1 — Choice and Consent**

- **Control:** Consent ledger (`consent_ledger` table) records every
  grant / revoke of each consent key (`termsOfService`,
  `privacyPolicy`, `memoryExtraction`, `marketing`,
  `ageConfirmation`). Every change is audit-logged
  (`consent.update` action).
- **Evidence:** `src/lib/consent.ts`, `consent_ledger` table,
  `src/app/api/consent/route.ts`.
- **Frequency:** Continuous.
- **Owner:** Engineering / Legal.

**P3.1 — Collection (Data Minimization)**

- **Control:** Registration collects only email + password. No
  demographic, location, or biometric data. Optional profile fields
  are explicit opt-in.
- **Evidence:** `src/app/api/auth/register/route.ts`,
  `prisma/schema.prisma` (User model).
- **Frequency:** Continuous.
- **Owner:** Engineering.

**P4.1 — Retention & Disposal**

- **Control:** Verification tokens: 24h (email) / 1h (password reset),
  single-use, pruned automatically. Audit logs: 1-year retention.
  Account deletion anonymizes PII within 30 days (GDPR Art. 17).
- **Evidence:** `src/lib/verification-tokens.ts`,
  `src/app/api/account/route.ts`, `legal/PRIVACY_POLICY.md`
  (retention schedule).
- **Frequency:** Continuous.
- **Owner:** Engineering / Legal.

**P5.1 — Access (GDPR Art. 15, 20)**

- **Control:** `GET /api/account/export` returns a JSON bundle of all
  user data (conversations, memories, documents, audit logs).
  `GET /api/memory/export` returns just the long-term memories +
  embeddings.
- **Evidence:** `src/app/api/account/export/route.ts`,
  `src/app/api/memory/export/route.ts`.
- **Frequency:** On-demand.
- **Owner:** Engineering.

**P6.1 — Disclosure (Sub-processor List)**

- **Control:** Sub-processors are listed in `legal/PRIVACY_POLICY.md`
  and `legal/DATA_PROCESSING_AGREEMENT.md`. The DPA defines
  processor obligations, data location, and breach-notification
  timelines.
- **Evidence:** `legal/DATA_PROCESSING_AGREEMENT.md`,
  `legal/PRIVACY_POLICY.md`.
- **Frequency:** Reviewed annually + on sub-processor change.
- **Owner:** Legal.

**P7.1 — Data Quality & Correction**

- **Control:** Users can edit / delete their memories
  (`/api/memories/[id]`). Account settings allow email and password
  changes. Factual corrections in research reports are handled via
  feedback (`/api/feedback`).
- **Evidence:** `src/app/api/memories/[id]/route.ts`,
  `src/app/api/account/route.ts`, `src/app/api/feedback/route.ts`.
- **Frequency:** Continuous.
- **Owner:** Engineering.

**P8.1 — Monitoring & Enforcement**

- **Control:** `legal/INCIDENT_RESPONSE_PLAN.md` defines the 72-hour
  breach-notification timeline (GDPR Art. 33). The IR plan covers
  detection, containment, eradication, recovery, and post-mortem.
- **Evidence:** `legal/INCIDENT_RESPONSE_PLAN.md`, Sentry alert
  rules.
- **Frequency:** Per-incident.
- **Owner:** Security / Legal.

---

## 2. Audit Evidence Artifacts

The following table is the **evidence inventory** an auditor will
request at engagement kickoff. Each artifact is mapped to the TSC
criteria it supports.

| Artifact | Path | TSC Criteria |
|---|---|---|
| Privacy Policy | `legal/PRIVACY_POLICY.md` | P1, P3, P4, P6 |
| Terms of Service | `legal/TERMS_OF_SERVICE.md` | CC2.1, P1 |
| Data Processing Agreement | `legal/DATA_PROCESSING_AGREEMENT.md` | CC9.1, P6 |
| SLA | `legal/SLA.md` | A1.2 |
| Cookie Policy | `legal/COOKIE_POLICY.md` | P1, P2 |
| Acceptable Use Policy | `legal/ACCEPTABLE_USE_POLICY.md` | CC1.4 |
| CLA | `legal/CLA.md` | CC1.4 |
| ROPA | `legal/ROPA.md` | P3, P4, C1.1 |
| Incident Response Plan | `legal/INCIDENT_RESPONSE_PLAN.md` | CC7.1, P8 |
| SOC 2 Readiness | `legal/SOC2_READINESS.md` | All (gap analysis) |
| SOC 2 Type II Audit Prep | `legal/SOC2_TYPEII_AUDIT_PREP.md` | All (control mapping) |
| This document | `legal/SOC2_TYPE_II_AUDIT.md` | All (integrated package) |
| SECURITY.md | `SECURITY.md` | C1.1, CC6.1 |
| RBAC module | `src/lib/rbac.ts` | CC1.3, CC6.1 |
| MFA module | `src/lib/mfa.ts` | CC6.1 |
| Audit logger | `src/lib/audit.ts` | CC1.5, CC6.2 |
| Auth middleware | `src/lib/auth.ts` | CC5.1, CC6.1 |
| Verification tokens | `src/lib/verification-tokens.ts` | CC5.3, P4.1 |
| Consent ledger | `src/lib/consent.ts`, `consent_ledger` table | P2.1, PI1.1 |
| Credential encryption | `src/lib/credentials.ts` | C1.2, C2.1 |
| Rate limiter | `src/lib/rate-limit.ts` | A1.3, CC7.3 |
| Sanitize error | `src/lib/sanitize-error.ts` | C1.2 (no secret leakage) |
| Prompt security | `src/lib/prompt-security.ts` | CC5.1 (input defense) |
| CSRF protection | `src/lib/csrf.ts` | CC6.1 |
| LLM fallback chain | `src/lib/llm-provider.ts` | CC9.2 |
| Citation verifier | `src/lib/citation-verifier.ts` | PI2.1 |
| Self-critique prompt | `src/lib/prompts/self-critique.ts` | PI2.2 |
| Memory extractor (deny-list) | `src/lib/memory-extractor.ts` | PI1.2 |
| Account deletion (anonymize) | `src/app/api/account/route.ts` | CC5.3, P4.1 |
| Account export | `src/app/api/account/export/route.ts` | P5.1 |
| Memory export | `src/app/api/memory/export/route.ts` | P5.1 |
| Audit log API | `src/app/api/audit-logs/route.ts` | CC6.2 |
| Health endpoint | `src/app/api/health/route.ts` | CC7.3, A1.2 |
| Metrics endpoint | `src/app/api/metrics/route.ts` | CC4.1, CC7.3 |
| Sentry configs | `sentry.{server,edge,client}.config.ts` | CC4.1, CC7.3 |
| Backup script | `scripts/backup.sh` | CC7.2 |
| Docker compose | `docker-compose.yml` | CC7.2, CC8.3 |
| ADRs | `docs/adr/` | CC2.3, CC3.1 |
| CHANGELOG | `CHANGELOG.md` | CC2.2, CC8.1 |
| CONTRIBUTING | `CONTRIBUTING.md` | CC1.4, CC8.1 |
| tsconfig (strict) | `tsconfig.json` | CC1.4, CC4.2 |
| ESLint config | `eslint.config.mjs` | CC1.4, CC4.2 |
| CI workflow | `.github/workflows/ci.yml` | CC4.2, CC8.2 |
| Test suite | `src/lib/__tests__/` (451+ tests) | CC4.2 |
| E2E suite | `e2e/` (8 specs) | CC4.3 |
| Prisma schema | `prisma/schema.prisma` | C1.1, PI1.2 |

---

## 3. Gap Analysis

The following gaps must be closed before commissioning a SOC 2 Type II
audit engagement. Each gap has an owner, a target date, and the
remediation approach.

| # | Gap | TSC | Owner | Target | Remediation |
|---|---|---|---|---|---|
| G-1 | No formal HR Security Policy (background checks, onboarding/offboarding) | CC1.1 | Operations | T+30d | Add `legal/HR_SECURITY_POLICY.md`; document the background-check vendor and the offboarding checklist (access revocation within 24h). |
| G-2 | No status page (only a placeholder) | CC2.1, A1.2 | Operations | T+30d | Stand up Atlassian Statuspage or Cachet; wire `/api/health` to the status-page poller; document the incident-posting runbook. |
| G-3 | No formal risk register | CC3.1 | Security | T+60d | Create `docs/risk-register.md` with threat / likelihood / impact / mitigation columns; quarterly review cadence documented in `legal/SOC2_READINESS.md`. |
| G-4 | No annual penetration test report | CC4.3 | Security | T+90d | Commission an external pentest from a CRE / OSCP-certified firm; remediate findings before the audit window opens. |
| G-5 | No board charter (SaaS Edition) | CC1.2 | Legal | T+60d | Draft and ratify a board charter; document the oversight cadence (quarterly security review). |
| G-6 | DR runbook not externally documented | CC7.2 | Operations | T+30d | Move the internal DR runbook to `docs/DR_RUNBOOK.md`; document RPO/RTO, failover steps, and the quarterly drill cadence. |
| G-7 | No vendor SOC 2 reports collected | CC9.1 | Security | T+90d | Request SOC 2 Type II reports from AWS/GCP, Stripe, Resend, NVIDIA; review and file under NDA. |
| G-8 | Audit log retention not formally enforced | CC6.2 | Engineering | T+30d | Add a scheduled job to delete `audit_logs` rows older than 1 year (or extend to 7 years for regulated customers); document retention in `legal/PRIVACY_POLICY.md`. |
| G-9 | `email_verified` not enforced | PI1.1 | Engineering | T+30d | Wire `email_verified` into `requireAuth` or sensitive-route guards so unverified emails can't access PII-handling endpoints. |
| G-10 | No formal data classification policy | C1.1 | Security / Legal | T+60d | Promote the classification in `SECURITY.md` to a standalone `legal/DATA_CLASSIFICATION_POLICY.md`; add handling rules per classification. |
| G-11 | No Breach Notification Test | P8.1 | Security | T+90d | Run a tabletop exercise against `legal/INCIDENT_RESPONSE_PLAN.md`; document lessons learned; update the IR plan. |
| G-12 | No formal Change Advisory Board (CAB) | CC8.1 | Engineering | T+60d | Document the CAB process for production-impacting changes; emergency-change procedure documented separately. |

**Status:** G-1 through G-12 are pre-audit gaps. The remediation target
dates assume a T+0 of "green-light to close gaps"; the 6-month audit
observation window opens once all gaps are closed.

---

## 4. Audit Timeline

| Phase | Duration | Activities |
|---|---|---|
| Gap closure | 0 → T+90d | Remediate G-1 through G-12; commission pentest. |
| Auditor selection | T+60d → T+90d | Issue RFP to 3+ CPA firms; select auditor; sign engagement letter. |
| Observation period | T+90d → T+9mo | Controls operate in production; auditor samples evidence quarterly. |
| Fieldwork | T+9mo → T+11mo | Auditor interviews team, walks through controls, samples transactions. |
| Report issuance | T+11mo → T+12mo | Auditor drafts report; management review; final issuance. |

---

## 5. Conclusion

Quaesitor's application-layer controls are substantially in place for a
SOC 2 Type II audit. The 12 gaps identified above are predominantly
**process / documentation gaps** (HR policy, status page, risk register,
vendor reports) rather than **technical control gaps** — the technical
controls (RBAC, MFA, audit logging, encryption, citation verification,
consent ledger, etc.) are implemented, tested, and documented in code.

The recommended path is:
1. Close G-1 through G-12 within 90 days.
2. Commission the external penetration test (G-4) — this is the
   longest-lead-time item.
3. Issue the auditor RFP in parallel with gap closure.
4. Open the 6-month observation window once all gaps are closed and
   the pentest report is clean.

At the end of the observation period, this document will be updated
with the auditor's findings and the final SOC 2 Type II report will be
issued under separate cover by the CPA firm.
