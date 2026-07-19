# SOC 2 Type II Audit Preparation

> **Scope.** This document maps Quaesitor's **implemented** controls to the
> AICPA Trust Services Criteria (TSC) and provides observation-ready
> evidence for a SOC 2 Type II audit. It is a **deeper companion** to
> [`SOC2_READINESS.md`](./SOC2_READINESS.md) — the readiness assessment
> identifies gaps; this document maps what's already in place to the
> specific control points an auditor will test.
>
> **Status.** Self-hosted OSS. Enterprise / SaaS deployments should treat
> this as a starting template and supplement with their own
> infrastructure-level controls (physical security, HR, vendor management).

---

## Overview

A SOC 2 Type II report attests to the **operating effectiveness** of a
service organization's controls over a defined period (typically 6–12
months). Unlike Type I (point-in-time design), Type II requires evidence
that controls actually operated as described throughout the observation
period.

This document is organized by TSC category (CC1–CC9, A, PI, C, P) with
each control point mapped to:
- **Control**: what Quaesitor does.
- **Evidence**: where the proof lives (file path, table, log source).
- **Frequency**: how often the control operates.
- **Owner**: who is responsible (Engineering, Operations, etc.).

---

## Control Environment (CC1)

### CC1.1 — Control Environment

- **Control**: Code review via GitHub PRs (branch protection enforces PR workflow).
- **Evidence**: GitHub branch protection settings, PR review history.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC1.2 — Board of Directors Independence

- **N/A** for self-hosted OSS — no board oversight required.
- **Note**: Enterprise customers may require their own governance; this is
  out of scope for the OSS distribution.

### CC1.3 — Organizational Structure

- **Control**: RBAC with 4 roles (owner / admin / editor / viewer).
- **Evidence**: `src/lib/rbac.ts`, `workspace_members` table, audit logs
  (`workspace.create` / `workspace.invite` / `workspace.remove` actions).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC1.4 — Commitment to Competence

- **Control**: `CONTRIBUTING.md` documents the contribution workflow;
  CLA required for contributions; code style enforcement via ESLint
  (strict config, 0 warnings allowed).
- **Evidence**: `CONTRIBUTING.md`, `legal/CLA.md`, `eslint.config.mjs`,
  CI pipeline (lint + tsc + test gates on every PR).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC1.5 — Enforcement of Accountability

- **Control**: Audit logging for 27+ sensitive actions
  (`SENSITIVE_ACTIONS` map); audit log entries are anonymized on
  account deletion (GDPR Art. 17 — the user's identity is scrubbed but
  the audit trail of WHAT happened is retained for compliance).
- **Evidence**: `src/lib/audit.ts` (`SENSITIVE_ACTIONS` map),
  `audit_logs` table, `src/app/api/account/route.ts` (anonymization
  on delete).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

---

## Communication and Information (CC2)

### CC2.1 — Information Provided to External Parties

- **Control**: 11 legal documents published in `/legal/` cover the full
  subscriber lifecycle: Terms of Service, Privacy Policy, DPA, SLA,
  Cookie Policy, AUP, CLA, ROPA, Incident Response Plan, plus this SOC 2
  prep document and the readiness assessment.
- **Evidence**: `legal/` directory (11 files).
- **Frequency**: Reviewed quarterly, updated as needed.
- **Owner**: Engineering / Legal.

### CC2.2 — Internal Communication

- **Control**: `CHANGELOG.md` documents every release; GitHub Issues and
  PRs are the canonical communication channel for changes; structured
  logging via `pino` (`src/lib/logger.ts`) feeds a central log
  aggregator.
- **Evidence**: `CHANGELOG.md`, GitHub history, `src/lib/logger.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC2.3 — Communication of Objectives

- **Control**: `docs/ROADMAP_v2.md` documents the product roadmap;
  `DESIGN.md` documents the design system; ADRs in `docs/adr/` document
  architectural decisions with trade-offs.
- **Evidence**: `docs/ROADMAP_v2.md`, `DESIGN.md`, `docs/adr/`.
- **Frequency**: Reviewed quarterly.
- **Owner**: Engineering team.

---

## Risk Assessment (CC3)

### CC3.1 — Risk Identification

- **Control**: Independent security audits using a 10-angle audit
  framework (prompt injection, SSRF, CSRF, XSS, auth bypass, RBAC
  escalation, secrets leakage, DoS, supply chain, privacy). Findings
  are recorded in `worklog.md` audit sections.
- **Evidence**: `worklog.md` (security audit sections), `SECURITY.md`,
  `agent-ctx/deep-security-audit.md`.
- **Frequency**: Continuous (each release).
- **Owner**: Engineering team.

### CC3.2 — Risk Assessment

- **Control**: Threat model documented in `SECURITY.md` covers the
  OWASP Top 10 + AI-specific threats (prompt injection, training data
  poisoning, model extraction).
- **Evidence**: `SECURITY.md`.
- **Frequency**: Reviewed annually.
- **Owner**: Engineering team.

### CC3.3 — Fraud Risk

- **Control**: Stripe webhook signature verification prevents billing
  fraud; billing plans derived from Stripe lookup_key (not client-supplied
  plan names); metered usage tracked server-side.
- **Evidence**: `src/app/api/billing/webhook/route.ts` (signature
  verification), `src/lib/stripe.ts`, `src/lib/usage-tracker.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC3.4 — Changes That Could Impact Controls

- **Control**: CI/CD pipeline (bun + npm jobs) gates every PR on lint +
  tsc + test; Dependabot opens weekly dependency-update PRs; branch
  protection prevents direct pushes to `main`.
- **Evidence**: `.github/workflows/ci.yml`, `.github/dependabot.yml`,
  GitHub branch protection settings.
- **Frequency**: Continuous (CI on every PR; Dependabot weekly).
- **Owner**: Engineering team.

---

## Monitoring Activities (CC4)

### CC4.1 — Ongoing Evaluations

- **Control**: 451+ automated tests run on every PR (Vitest unit +
  integration); Playwright E2E suite covers 8 critical user flows;
  TypeScript strict mode + ESLint with 0 warnings enforced.
- **Evidence**: `bun run test` results (451 passed / 1 skipped baseline),
  CI logs, `vitest.config.ts`, `e2e/*.spec.ts`.
- **Frequency**: Continuous (every PR + nightly).
- **Owner**: Engineering team.

### CC4.2 — Deficiencies Communicated

- **Control**: GitHub Issues track bugs + security findings; Sentry
  captures runtime errors (client, edge, server); the
  `/api/feedback` endpoint collects user-reported issues.
- **Evidence**: `sentry.client.config.ts`, `sentry.edge.config.ts`,
  `sentry.server.config.ts`, `src/app/api/feedback/route.ts`, GitHub Issues.
- **Frequency**: Continuous (Sentry real-time; Issues triaged daily).
- **Owner**: Engineering team.

---

## Control Activities (CC5)

### CC5.1 — Selection of Controls

- **Control**: Defense-in-depth: auth (Basic + NextAuth) → RBAC (4 roles)
  → audit logging (27+ actions) → sanitize-error (no secret leakage).
  Each layer is independently testable.
- **Evidence**: `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/lib/audit.ts`,
  `src/lib/sanitize-error.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC5.2 — Deployment of Controls

- **Control**: Branch protection (no force push, PR review required);
  CI enforcement (lint + tsc + test must pass); Docker isolation for
  untrusted code execution (`--security-opt=no-new-privileges`,
  `--cap-drop=ALL`, `--network=none`).
- **Evidence**: GitHub branch protection settings, `Dockerfile`,
  `src/lib/code-sandbox-docker.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering / Operations.

### CC5.3 — Design of Controls

- **Control**: `safeFetch` prevents SSRF (DNS rebinding + private-IP
  blocking); CSRF utility generates + validates tokens; CSP headers
  restrict script sources; HSTS enforced (2-year max-age).
- **Evidence**: `src/lib/safe-fetch.ts`, `src/lib/csrf.ts`,
  `next.config.ts` (security headers section).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

---

## Logical and Physical Access (CC6)

### CC6.1 — Logical Access Security

- **Control**: Basic Auth (fail-closed in production — 503 if creds
  missing); MFA via TOTP (RFC 6238, 6-digit, 30s window, single-use
  backup codes); API Keys stored as SHA-256 hashes (never plaintext);
  SSO via SAML + OIDC for Enterprise.
- **Evidence**: `src/lib/auth.ts` (fail-closed logic), `src/lib/mfa.ts`,
  `api_keys` table (hashed keys), `src/lib/sso/saml.ts`,
  `src/lib/sso/oidc.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC6.2 — User Authentication

- **Control**: `requireAuth(req)` enforced on 43+ API routes;
  `requireApiKey(req)` enforced on all `/api/v1/*` public API routes;
  `requireAdminAccess(req)` adds an IP allowlist for admin routes.
- **Evidence**: API route audit (see `agent-ctx/deep-security-audit.md`
  for the full route inventory).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC6.3 — Access Authorization

- **Control**: RBAC (owner / admin / editor / viewer) enforced via
  `requireRole()`; workspace membership checked on every multi-tenant
  operation; project ownership verified before connector / billing
  mutations.
- **Evidence**: `src/lib/rbac.ts`, `workspace_members` table,
  `src/app/api/workspaces/[id]/members/route.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC6.4 — Access Removal

- **Control**: `DELETE /api/account` implements GDPR Art. 17 (right to
  erasure) — deletes the user's data AND anonymizes their audit log
  entries (the audit trail of WHAT happened is retained, but the user's
  identity is scrubbed).
- **Evidence**: `src/app/api/account/route.ts`, audit log anonymization
  logic.
- **Frequency**: On request (Art. 17: "without undue delay").
- **Owner**: Engineering team.

### CC6.5 — Physical Access

- **N/A** — self-hosted OSS. Enterprise customers manage their own
  physical security (data center SOC 2 / ISO 27001 certifications,
  badge access, CCTV, etc.).

---

## System Operations (CC7)

### CC7.1 — System Configuration

- **Control**: Docker hardening for the code sandbox:
  `--security-opt=no-new-privileges`, `--cap-drop=ALL`, `--ulimit`,
  `--network=none`, `--read-only` filesystem, `/tmp` tmpfs. The base
  `Dockerfile` uses a non-root user.
- **Evidence**: `src/lib/code-sandbox-docker.ts`, `Dockerfile`.
- **Frequency**: Continuous (every execution).
- **Owner**: Engineering team.

### CC7.2 — Software Vulnerability

- **Control**: Dependabot opens weekly dependency-update PRs;
  `npm audit` runs in CI; branch protection requires review before
  merge; `sanitize-error` prevents secret leakage in error messages.
- **Evidence**: `.github/dependabot.yml`, CI pipeline.
- **Frequency**: Weekly (Dependabot) + continuous (CI).
- **Owner**: Engineering team.

### CC7.3 — Change Management

- **Control**: Branch protection (no force push to `main`); mandatory PR
  review; CI gates (lint + tsc + test must pass); database migrations
  are version-controlled (`prisma/migrations/`).
- **Evidence**: `CONTRIBUTING.md` (branch protection section),
  `prisma/migrations/`, GitHub settings.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### CC7.4 — Incident Response

- **Control**: Incident Response Plan documents detection, classification
  (P1 / P2 / P3), response, and 72-hour breach notification (GDPR Art. 33).
- **Evidence**: `legal/INCIDENT_RESPONSE_PLAN.md`.
- **Frequency**: Plan reviewed annually; tabletop exercises quarterly.
- **Owner**: Engineering / Operations.

---

## Change Management (CC8)

### CC8.1 — Authoritative Changes

- **Control**: `CHANGELOG.md` documents every released change with
  semver versioning; releases are tagged on GitHub; database migrations
  include down-migrations where feasible.
- **Evidence**: `CHANGELOG.md`, GitHub release tags, `prisma/migrations/`.
- **Frequency**: Per release.
- **Owner**: Engineering team.

---

## Risk Mitigation (CC9)

### CC9.1 — Risk Mitigation

- **Control**: Multi-provider LLM fallback (NVIDIA → OpenAI → Anthropic →
  Ollama) ensures the service degrades gracefully when a provider fails.
  Cross-provider fallback is automatic — no user intervention required.
- **Evidence**: `src/lib/llm-provider.ts` (cross-provider fallback logic),
  `docs/adr/0003-cross-provider-llm-fallback.md`.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

---

## Availability (A)

### A1.1 — Environmental Protections

- **N/A** — self-hosted OSS. Enterprise customers manage their own
  infrastructure (data center environmental controls: fire suppression,
  HVAC, flood detection, etc.).

### A1.2 — Infrastructure Capacity

- **Control**: `MAX_JOBS` env var caps in-memory research jobs (default
  100); BullMQ queue spills overflow to Redis (when configured);
  research-result cache prevents duplicate work; rate limiting
  prevents quota abuse.
- **Evidence**: `src/lib/research-store.ts`, `src/lib/research-cache.ts`,
  `src/lib/rate-limit.ts`, `src/lib/queue.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering / Operations.

### A1.3 — Incident Recovery

- **Control**: Backup script (`scripts/backup.sh`) takes daily SQLite
  snapshots with 30-day retention; database is the source of truth —
  the in-memory state can be rebuilt from it on restart.
- **Evidence**: `scripts/backup.sh`.
- **Frequency**: Daily (cron) + on-demand.
- **Owner**: Operations.

---

## Processing Integrity (PI)

### PI1.1 — Valid Input

- **Control**: Input validation on every API route (Zod schemas + manual
  shape checks); prompt-injection defense (NFKC Unicode normalization +
  homoglyph detection + multi-language injection patterns).
- **Evidence**: `src/lib/prompt-security.ts`, API route validation
  (e.g. `src/app/api/device-control/route.ts` `isDeviceAction` check).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### PI1.2 — Processing Authorization

- **Control**: Consent ledger (GDPR Art. 7) — every processing purpose
  (termsOfService, privacyPolicy, memoryExtraction, marketing,
  ageConfirmation) requires explicit consent; plan limits enforced
  (402 Payment Required on over-limit).
- **Evidence**: `src/lib/consent.ts`, `src/lib/plan-limits.ts`,
  `src/app/api/consent/route.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

---

## Confidentiality (C)

### C1.1 — Confidential Information

- **Control**: AES-256-GCM encryption for connector credentials at rest
  (per-record random IV); fail-closed in production (decryption returns
  null if `CREDENTIALS_ENCRYPTION_KEY` is missing — never logs plaintext).
- **Evidence**: `src/lib/credentials.ts` (`encryptCredentials` /
  `decryptSafe`), `src/lib/env.ts` (fail-closed logic).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### C1.2 — Transmission

- **Control**: HTTPS enforced (HSTS 2-year max-age, `includeSubDomains`);
  CSP restricts `connect-src` to `self` + `https:`; no mixed content;
  TLS 1.2+ minimum.
- **Evidence**: `next.config.ts` (security headers section).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

---

## Privacy (P)

### P1.1 — Personal Information Collection

- **Control**: Privacy Policy documents minimal data collection
  (only what's needed for the service); consent ledger records explicit
  consent for each processing purpose.
- **Evidence**: `legal/PRIVACY_POLICY.md`, `src/lib/consent.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering / Legal.

### P2.1 — Use and Retention

- **Control**: Data retention periods documented in the Privacy Policy;
  memory TTL configurable; audit logs retained for the lifetime of the
  account (anonymized on deletion).
- **Evidence**: `legal/PRIVACY_POLICY.md` (retention table).
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### P3.1 — Disclosure

- **Control**: Sub-processor list (NVIDIA, OpenAI, Anthropic, Stripe,
  Resend) disclosed in the DPA + Privacy Policy; each sub-processor's
  SOC 2 report reviewed annually (for SaaS Edition).
- **Evidence**: `legal/DATA_PROCESSING_AGREEMENT.md`, `legal/PRIVACY_POLICY.md`.
- **Frequency**: Annual review.
- **Owner**: Engineering / Legal.

### P4.1 — Rights

- **Control**: `DELETE /api/account` (Art. 17 — erasure);
  `GET /api/account/export` (Art. 20 — portability); consent ledger
  (Art. 7 — demonstrable consent); `GET /api/memory/export` (memory
  portability subset).
- **Evidence**: `src/app/api/account/route.ts`,
  `src/app/api/account/export/route.ts`, `src/app/api/consent/route.ts`,
  `src/app/api/memory/export/route.ts`.
- **Frequency**: On request.
- **Owner**: Engineering team.

### P5.1 — Monitoring

- **Control**: Audit logs (27+ sensitive actions) record every
  significant user action; access logging on every authenticated route.
- **Evidence**: `src/lib/audit.ts`, `audit_logs` table,
  `src/app/api/audit-logs/route.ts`.
- **Frequency**: Continuous.
- **Owner**: Engineering team.

### P6.1 — Changes

- **Control**: Consent can be revoked at any time via `/api/consent`;
  revocation is logged in the consent ledger; processing stops
  immediately for the revoked purpose.
- **Evidence**: `src/app/api/consent/route.ts`, `src/lib/consent.ts`.
- **Frequency**: On request.
- **Owner**: Engineering team.

---

## Audit Timeline

1. **Month 1–2**: Pre-audit assessment (gap analysis using this document
   + `SOC2_READINESS.md`).
2. **Month 3–8**: Observation period (Type II requires 6+ months of
   evidence that controls actually operated).
3. **Month 9**: Auditor fieldwork (interviews, evidence sampling,
   control testing).
4. **Month 10**: Report issuance.

---

## Prerequisites for Type II

- [x] 6 months of audit log retention (currently: unlimited — audit_logs
      table is never auto-truncated; anonymized on account deletion).
- [x] Documented change management process (branch protection + PR review
      + CI gates).
- [x] Incident response plan (`legal/INCIDENT_RESPONSE_PLAN.md`).
- [x] Data retention policy (`legal/PRIVACY_POLICY.md` retention table).
- [x] Access control policy (RBAC + auth + MFA).
- [x] Encryption at rest (AES-256-GCM for credentials).
- [x] Encryption in transit (HTTPS + HSTS + CSP).
- [x] Backup and recovery (`scripts/backup.sh`, 30-day retention).
- [x] Vulnerability management (Dependabot + `sanitize-error`).
- [x] Network security (`safeFetch` SSRF prevention + CSP + Docker
      `--network=none`).
- [ ] **Gap**: formal HR Security Policy (not customer-facing for OSS).
- [ ] **Gap**: status page (placeholder only).
- [ ] **Gap**: formal risk register.
- [ ] **Gap**: anomaly detection on audit logs.
- [ ] **Gap**: SSO (SAML/OIDC) for Enterprise — interfaces exist
      (`src/lib/sso/`), wiring is in progress.
- [ ] **Gap**: DPIA for memory extraction (GDPR Art. 35).

---

## See Also

- [`SOC2_READINESS.md`](./SOC2_READINESS.md) — gap analysis + readiness
  assessment (the companion document that identifies what's NOT yet in
  place).
- [`SECURITY.md`](../SECURITY.md) — threat model + responsible disclosure.
- [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) — data collection, retention,
  sub-processors.
- [`INCIDENT_RESPONSE_PLAN.md`](./INCIDENT_RESPONSE_PLAN.md) — P1/P2/P3
  classification + 72-hour breach notification.
- [`DATA_PROCESSING_AGREEMENT.md`](./DATA_PROCESSING_AGREEMENT.md) —
  Art. 28 GDPR sub-processor terms.
