# SOC 2 Type II Readiness Assessment

> **Disclaimer.** This document is a **readiness assessment**, not an
> actual SOC 2 report. A SOC 2 Type II report is issued by an
> independent third-party auditor after a formal audit engagement
> (typically 6–12 months of operating-effectiveness observation). This
> document maps the AICPA Trust Services Criteria (TSC) to Quaesitor's
> current controls and identifies gaps that should be closed before
> commissioning an audit.

**Version:** 1.0
**Last updated:** 2026-07-17
**Issuer:** Quaesitor Project
**Scope:** SaaS Edition of the Quaesitor Service.
**`[Self-Hosted Edition]`** This assessment does **not** apply to
self-hosted deployments. Operators of the Self-Hosted Edition are
responsible for their own SOC 2 readiness (and may use this document
as a starting point).

---

## 1. Overview

The American Institute of Certified Public Accountants (AICPA) SOC 2
framework evaluates service organisations against the Trust Services
Criteria (TSC): **Security** (always), and optionally **Availability**,
**Processing Integrity**, **Confidentiality**, and **Privacy**.
Quaesitor targets all five categories.

This document maps each criterion to the controls Quaesitor has
implemented, identifies gaps, and notes the evidence a future
auditor would request.

## 2. Security (Common Criteria — CC1 through CC9)

The Security category (Common Criteria) is mandatory for every SOC 2
engagement. It is organised into nine criteria areas:

### CC1 — Control Environment

- **Organisational structure:** the Quaesitor Project maintains a
  documented governance model with designated maintainers for each
  subsystem (research engine, billing, auth, connectors).
- **Integrity and ethics:** the Acceptable Use Policy, Contributor
  License Agreement, and Code of Conduct establish behavioural
  expectations.
- **Human resources:** background-check and onboarding/offboarding
  procedures for the SaaS Edition operations team are documented
  internally.
- **Gap:** formal HR procedures are not yet documented in a
  customer-facing artefact. **Recommendation:** add an HR Security
  Policy to `/legal/`.

### CC2 — Communication and Information

- **Internal:** structured logging via `pino` (see `src/lib/logger.ts`)
  feeds a central log aggregator. Audit logs (`audit_logs` table)
  record every sensitive action.
- **External:** Privacy Policy, Terms of Service, SLA, and this
  document communicate commitments to Subscribers. A status page
  (`status.quaesitor.local`) communicates incidents and maintenance.
- **Gap:** the status page is a placeholder. **Recommendation:**
  stand up an actual status page (e.g. Atlassian Statuspage,
  Cachet, or a static-site generator publishing to S3+CloudFront).

### CC3 — Risk Assessment

- **Threat modelling:** the project maintains Architecture Decision
  Records (ADRs) in `/docs/adr/` that document security trade-offs
  (e.g. fail-closed auth, credential encryption).
- **Vendor risk:** sub-processors are listed in the Privacy Policy
  and DPA. Each sub-processor's SOC 2 report is reviewed annually.
- **Gap:** a formal risk register is not yet maintained.
  **Recommendation:** create and quarterly-review a risk register
  tracking threats, likelihood, impact, and mitigations.

### CC4 — Monitoring Activities

- **Continuous monitoring:** Sentry captures runtime errors
  (`sentry.server.config.ts`, `sentry.edge.config.ts`). The `/api/health`
  endpoint is polled by external probes for uptime monitoring.
- **Audit log review:** sensitive-action audit entries are recorded
  (see `src/lib/audit.ts` `SENSITIVE_ACTIONS` map). The
  `/api/audit-logs` endpoint exposes them to the user; for the SaaS
  Edition, operations staff review entries daily.
- **Gap:** automated alerting on audit anomalies (e.g. spike in
  `auth.mfa_disable` events) is not yet implemented. **Recommendation:**
  add anomaly-detection rules to the log aggregator.

### CC5 — Control Activities

- **Segregation of duties:** GitHub branch protection requires PR
  review by a maintainer other than the author. Production deployments
  require two-person approval.
- **Change management:** all code changes are reviewable via PR.
  Database schema migrations are version-controlled
  (`prisma/migrations/`).
- **Gap:** no formal change-advisory board. **Recommendation:** for
  Enterprise Subscribers, document a CAB process for production
  changes.

### CC6 — Logical and Physical Access Controls

- **Authentication:** HTTP Basic Auth with env-var credentials
  (`AUTH_USERNAME`/`AUTH_PASSWORD`), fail-closed in production. JWT
  sessions via NextAuth for Subscriber accounts. Passwords hashed
  with bcrypt (cost factor 10).
- **Multi-factor authentication:** TOTP-based MFA (RFC 6238, 6-digit,
  30-second window) with single-use backup codes. See
  `src/lib/mfa.ts` and `/api/auth/mfa/{setup,verify,disable}`.
- **Authorisation:** `getUserId(req)` is the canonical identity
  resolver; `requireAuth(req)` enforces authentication;
  `requireAdminAccess(req)` adds an IP allowlist for admin routes.
- **Connector credentials:** AES-256-GCM encryption at rest with
  per-record random IVs (`src/lib/credentials.ts`). Plaintext is
  never logged.
- **Rate limiting:** per-IP and per-user limits prevent brute-force
  and quota abuse. The rate-limit Map has a hard cap of 10 000
  buckets with lazy pruning.
- **Physical access:** the SaaS Edition runs on cloud infrastructure
  (AWS/GCP/Azure — configure for your deployment) whose data centres
  are SOC 2 / ISO 27001 certified. The Quaesitor Project has no
  on-premise infrastructure.
- **Gap:** SSO (SAML/OIDC) for Enterprise Subscribers is not yet
  implemented. **Recommendation:** add SAML support via NextAuth
  provider.

### CC7 — System Operations

- **Change management:** documented in CC5.
- **Patch management:** dependencies are updated via Dependabot
  automated PRs; security advisories are triaged within 48 hours.
- **Vulnerability management:** the `/SECURITY.md` policy documents
  responsible disclosure. Automated vulnerability scanning
  (`npm audit`, Snyk) runs in CI.
- **Incident response:** the Incident Response Plan
  (`/legal/INCIDENT_RESPONSE_PLAN.md`) defines detection,
  classification (P1/P2/P3), response, and breach-notification
  procedures.
- **Gap:** tabletop exercises are run informally; cadence is not
  formalised. **Recommendation:** quarterly tabletop exercises with
  documented outcomes.

### CC8 — Change Management

- **Code review:** mandatory PR review with branch protection.
- **Testing:** Vitest unit/integration tests (`bun run test`),
  Playwright E2E tests (`bun run e2e`). CI must pass before merge.
- **Staging environment:** changes deploy to a staging environment
  before production. Production deployments are gated on staging
  sign-off.
- **Rollback:** database migrations include down-migrations where
  feasible; application deploys use Next.js standalone build with
  atomic cutover.
- **Gap:** canary/progressive delivery is not yet implemented.
  **Recommendation:** add canary deploys via feature flags
  (e.g. Unleash, LaunchDarkly).

### CC9 — Risk Mitigation

- **Business continuity:** database backups (daily snapshots, 30-day
  retention) and a documented disaster-recovery runbook.
- **Disaster recovery:** RTO = 4 hours, RPO = 24 hours (daily backup
  cadence).
- **Vendor management:** sub-processor list reviewed annually.
- **Gap:** DR runbook is internal; not customer-facing.
  **Recommendation:** publish a DR summary in the SLA.

## 3. Availability

- **Uptime target:** 99.5% Monthly Uptime Percentage (see SLA,
  Section 2).
- **Redundancy:** the SaaS Edition runs behind a load balancer with
  multiple application instances. The database (Postgres) uses
  read replicas and automated failover.
- **Backups:** daily database snapshots with 30-day retention;
  point-in-time recovery (PITR) for the last 7 days.
- **Capacity planning:** monitoring dashboards track CPU, memory,
  disk, and request latency. Alerts fire at 70% utilisation.
- **Gap:** multi-region failover is not yet automated.
  **Recommendation:** document and test a multi-region DR plan.

## 4. Processing Integrity

- **Research pipeline integrity:** the deep-research engine
  (`src/lib/research-engine.ts`) verifies every citation via
  `src/lib/citation-verifier.ts`. Sources that fail verification are
  excluded from the report and logged.
- **Memory pipeline:** long-term memories extracted from conversations
  are stored with confidence scores (`confidence REAL DEFAULT 0.5` in
  SQLite schema). Memories below 0.5 confidence are not surfaced.
- **Source tier ratings:** sources are classified ★★★ academic / ★★☆
  industry / ★☆☆ general to give the Subscriber transparency into
  evidence quality.
- **Error handling:** errors in the research pipeline are logged with
  full context (jobId, stage, source URL) and surfaced to the user
  via the research status endpoint.
- **Gap:** end-to-end data-lineage tracking (query → sub-query →
  source → citation) is not yet captured in audit logs.
  **Recommendation:** add a `research.lineage` audit action.

## 5. Confidentiality

- **Encryption at rest:** connector credentials encrypted with
  AES-256-GCM. Database-level encryption (TDE) is enabled on the
  Postgres instance. Disk-level encryption (LUKS / cloud-provider
  EBS encryption) is enabled on all storage volumes.
- **Encryption in transit:** TLS 1.2+ enforced end-to-end. HSTS
  preload (2-year max-age, `includeSubDomains`). The
  `Content-Security-Policy` header restricts `connect-src` to
  `self` + `https:`.
- **Fail-closed auth:** in production with no `AUTH_USERNAME` set,
  protected routes return 503 rather than allowing anonymous access.
- **Secret management:** `CREDENTIALS_ENCRYPTION_KEY` is the root
  key for connector credential encryption. Key rotation is a manual
  process documented in the operations runbook.
- **Gap:** secrets are stored in environment variables (or cloud
  KMS for production). **Recommendation:** formalise key-rotation
  policy and add automated rotation tooling.

## 6. Privacy

- **GDPR compliance:** the Privacy Policy documents the lawful basis
  for each processing purpose. GDPR Articles 15–22 are honoured via
  the `/api/account/export` (Art. 20 — portability) and
  `/api/account` (Art. 17 — erasure) endpoints.
- **Data retention:** conversation, memory, and research-job data is
  retained for the lifetime of the account. Audit logs are retained
  for 2 years (operational) then archived for 5 additional years
  (compliance). Backup data is retained for 30 days.
- **User rights:** the Privacy Policy enumerates access, rectification,
  erasure, portability, objection, and not-to-be-subject-to-automated-
  decision-making rights. The `/api/account/*` endpoints implement
  these.
- **Sub-processor management:** the DPA (Art. 28 GDPR) and RoPA
  (Art. 30 GDPR) document all sub-processors and processing
  activities.
- **Cookie consent:** a Cookie Consent banner
  (`src/components/CookieConsent.tsx`) appears on first visit.
  Quaesitor uses only essential cookies — no tracking, no analytics.
  See the Cookie Policy for the full list.
- **Data Processing Agreement:** available at `/legal/DATA_PROCESSING_AGREEMENT.md`.
- **Gap:** a Data Protection Impact Assessment (DPIA) under Art. 35
  GDPR has not been performed. **Recommendation:** perform a DPIA for
  the memory-extraction feature (automated profiling of user content).

## 7. Summary of Gaps

| Criterion | Gap | Priority |
|---|---|---|
| CC1 | HR Security Policy not customer-facing | Medium |
| CC2 | Status page is a placeholder | High |
| CC3 | No formal risk register | Medium |
| CC4 | No anomaly-detection on audit logs | Medium |
| CC5 | No formal CAB process | Low |
| CC6 | No SSO (SAML/OIDC) for Enterprise | High |
| CC7 | Tabletop exercises not formalised | Medium |
| CC8 | No canary deploys | Low |
| CC9 | DR runbook not customer-facing | Medium |
| Availability | No multi-region failover | Medium |
| Processing Integrity | No end-to-end lineage in audit logs | Low |
| Confidentiality | No automated key rotation | Medium |
| Privacy | No DPIA for memory extraction | High |

## 8. Audit Engagement Readiness

Closing the High-priority gaps above is a prerequisite for a SOC 2
Type II audit engagement. Estimated timeline: 3–6 months to close
gaps, then 6–12 months of operating-effectiveness observation before
the Type II report can be issued.

For an interim signal, a SOC 2 Type I (point-in-time) report can be
commissioned after the High-priority gaps are closed.

## 9. Contact

Questions about this readiness assessment may be directed to
**security@quaesitor.local** (placeholder — configure a monitored
mailbox for your deployment).
