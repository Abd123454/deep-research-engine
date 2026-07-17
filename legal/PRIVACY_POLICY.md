# Privacy Policy

> **Disclaimer.** This document is a template provided by the Quaesitor
> Project for general informational purposes only. It is not legal
> advice and does not create an attorney–client relationship. Before
> relying on, publishing, or enforcing this document, have a qualified
> lawyer admitted in your jurisdiction review and adapt it to your
> specific deployment, customer base, and applicable law, including the
> EU General Data Protection Regulation (Regulation (EU) 2016/679,
> "GDPR"), the UK GDPR, the California Consumer Privacy Act (Cal.
> Civ. Code § 1798.100 et seq., "CCPA"), and other applicable data
> protection laws.

**Version:** 1.0
**Last updated:** 2026-07-17
**Issuer:** Quaesitor Project

---

## 1. Overview

This Privacy Policy describes how the Quaesitor Project
("**Quaesitor**", "**we**", "**us**") collects, uses, discloses, and
protects personal data when you use Quaesitor (the "**Service**"),
including the hosted SaaS Edition and the source code you can deploy
yourself (the "**Self-Hosted Edition**").

### 1.1 Who is the data controller?

- **SaaS Edition.** When you use the SaaS Edition, the Quaesitor
  Project is the **data controller** for personal data we collect to
  operate the Service (account, usage, billing), and a **data
  processor** for User Content you submit (conversations, memories,
  documents) — see Section 4.
- **`[Self-Hosted Edition]`** When you deploy the Self-Hosted Edition,
  **you are the data controller**. The Quaesitor Project has no access
  to your instance or its data. This Privacy Policy is provided as a
  template that you may adapt for your end-users; you are responsible
  for issuing your own privacy notice and for compliance with
  applicable law.

## 2. Personal Data We Collect

| Category | Description | Example fields |
|---|---|---|
| **Account data** | Information needed to authenticate you | email, hashed password, name (optional) |
| **Conversations** | Prompts, completions, and metadata you generate | message text, role, model used, timestamps |
| **Memories** | Long-term facts extracted from your usage | subject, predicate, object, access count, last accessed |
| **Documents** | Files you upload or generate | filename, parsed text, embeddings, source tier |
| **Connectors** | Credentials for third-party services (e.g. GitHub) | OAuth tokens, personal access tokens — **encrypted at rest with AES-256-GCM** |
| **Research jobs** | Deep-research plans, sub-queries, sources, reports | query, plan, citations, status, artifacts |
| **Artifacts** | Generated files (documents, slides, images, code) | file content, type, size, storage path |
| **Usage logs** | Service operation logs for security and debugging | IP address, request path, status, timestamp |
| **Audit logs** | Records of sensitive actions | `account.export`, `account.delete`, action, userId, timestamp |
| **Billing data** | Subscription and payment records | plan, Stripe customer ID, invoices, last 4 digits of card |

### 2.1 Sensitive data
Do **not** submit special-category personal data (health, racial or
ethnic origin, religious beliefs, biometric or genetic data, sex life
or sexual orientation, trade-union membership) unless strictly
necessary. If you must, you warrant that you have a lawful basis and
have provided the additional notices required by Article 9 GDPR.

## 3. Legal Basis for Processing (GDPR)

We process personal data under the following legal bases:

| Purpose | Legal basis (Art. 6 GDPR) |
|---|---|
| Provide the Service (conversations, research, memories) | **Contract** (Art. 6(1)(b)) |
| Account creation and authentication | **Contract** (Art. 6(1)(b)) |
| Billing and tax record-keeping | **Contract** and **legal obligation** (Art. 6(1)(b), (c)) |
| Security, fraud and abuse prevention | **Legitimate interest** (Art. 6(1)(f)) |
| Service improvement and diagnostics | **Legitimate interest** (Art. 6(1)(f)) — aggregated/anonymised where feasible |
| Email notifications (welcome, receipts) | **Consent** or **Contract** (Art. 6(1)(a) or (b)) |
| Compliance with legal obligations | **Legal obligation** (Art. 6(1)(c)) |

### 3.1 CCPA basis
For California residents, the personal data described above is
collected to perform the contract with you, to maintain security, and
to comply with legal obligations. We do **not** sell personal data and
do **not** process personal data for cross-context behavioural
advertising.

## 4. Purposes of Processing

We process personal data to:

1. **Provide the Service** — store and recall conversations, memories,
   documents, research jobs, and artifacts; route prompts to LLM
   providers; run code-sandboxed tasks; deliver voice and vision
   features.
2. **Improve quality** — debug defects, evaluate model performance on
   your data only with your explicit opt-in or where aggregated and
   anonymised.
3. **Billing** — manage subscriptions, process payments, issue
   receipts, and handle disputes via Stripe.
4. **Security** — detect and prevent fraud, abuse, prompt-injection
   attacks, and unauthorised access; maintain audit logs.
5. **Compliance** — meet legal retention obligations, respond to
   lawful requests, and cooperate with regulators.

## 5. Third-Party Processors

We use the following sub-processors. Each receives personal data only
as necessary to provide the contracted service and is bound by
contractual obligations to protect it.

| Sub-processor | Purpose | Data transferred | Location |
|---|---|---|---|
| **NVIDIA NIM** | LLM inference | Prompts, completions (transient) | United States / EU (per deployment) |
| **OpenAI** | LLM inference, embeddings, vision | Prompts, completions, images | United States |
| **Anthropic** | LLM inference | Prompts, completions | United States |
| **Ollama** | Local LLM inference | Prompts, completions | Your infrastructure (no transfer) |
| **Stripe** | Payment processing | Billing data, card tokens | United States (Stripe data residency applies) |
| **Resend** | Transactional email | Email address, message content | United States / EU |

### 5.1 `[Self-Hosted Edition]`
You select and configure your own sub-processors. The list above is
the default set; review the providers you enable and update this
section accordingly. When you connect a service via the connectors
feature (e.g. GitHub), that provider becomes your sub-processor for
the data exchanged.

### 5.2 International data transfers
NVIDIA, OpenAI, Anthropic, Stripe, and Resend may process data in the
United States. For transfers out of the EEA, UK, or Switzerland, we
rely on Standard Contractual Clauses ("SCCs") adopted by the European
Commission, the UK International Data Transfer Addendum, and — where
applicable — the EU-US Data Privacy Framework certifications of
providers that participate. A copy of relevant SCCs is available on
request.

## 6. Your Privacy Rights

### 6.1 GDPR rights (Articles 15–22)
Residents of the EEA, UK, and Switzerland have the following rights:

- **Right of access** (Art. 15) — obtain a copy of your personal data.
- **Right to rectification** (Art. 16) — correct inaccurate data.
- **Right to erasure** ("right to be forgotten", Art. 17) — delete
  your account and personal data. **Exercise via** `DELETE /api/account`.
- **Right to restriction** (Art. 18) — limit processing pending
  resolution of a dispute.
- **Right to data portability** (Art. 20) — receive your data in a
  structured, machine-readable JSON file. **Exercise via**
  `GET /api/account/export`.
- **Right to object** (Art. 21) — object to processing based on
  legitimate interests or for direct marketing.
- **Rights regarding automated decision-making** (Art. 22) — not to be
  subject to decisions based solely on automated processing that
  produce legal or similarly significant effects, except where
  necessary for a contract, authorised by law, or based on explicit
  consent.

### 6.2 CCPA rights
California residents have the right to: know what personal data is
collected and sold (we sell none); request deletion; request
correction; opt out of sale or sharing (not applicable — we do not
sell or share for cross-context advertising); and not be discriminated
against for exercising rights. Submit requests to
**privacy@quaesitor.local** (placeholder).

### 6.3 Exercising your rights
You may exercise most rights directly through the Service:

- **Delete your account and data:** `DELETE /api/account`
- **Export your data (portability):** `GET /api/account/export`
  (returns a JSON file with `Content-Disposition: attachment;
  filename="quaesitor-data-export.json"`)

Both endpoints require authentication in production and log an audit
entry on each call. Alternatively, contact
**privacy@quaesitor.local** (placeholder). We respond within thirty
(30) days, extendable by sixty (60) days where permitted by law with
notice to you.

### 6.4 Right to withdraw consent
Where processing relies on consent, you may withdraw consent at any
time without affecting the lawfulness of processing before withdrawal.
Withdraw consent via the relevant settings page or by contacting us.

### 6.5 Right to lodge a complaint
You have the right to lodge a complaint with your supervisory
authority (EEA/UK) or the California Attorney General (CCPA). We
encourage you to contact us first.

## 7. Retention

We retain personal data only as long as necessary for the purposes
described, then delete or anonymise it.

| Data category | Retention period | Basis |
|---|---|---|
| Conversations | Until you delete them | Contract |
| Memories | Until you delete them | Contract |
| Documents | Until you delete them | Contract |
| Connectors (encrypted) | Until you delete the connector | Contract |
| Research jobs and artifacts | Until you delete them | Contract |
| Usage logs | 90 days | Security / legitimate interest |
| Audit logs | 24 months | Security / legitimate interest |
| Billing records | 7 years | Tax / legal obligation |
| Account data | Until account deletion | Contract |
| Backups | Up to 35 days, then overwritten | Operational continuity |

`DELETE /api/account` removes all user-scoped data in a single
transaction (conversations, memories, documents, projects,
connectors, subscriptions, usage records, preferences, audit logs,
artifact storage). Backups may persist for up to 35 days thereafter
before being overwritten.

## 8. Security Measures

We implement industry-standard technical and organisational measures
including:

- **Encryption at rest** for connector credentials using AES-256-GCM
  with per-record random IVs (`iv:tag:ciphertext` format).
- **Fail-closed authentication** — endpoints that touch user-scoped
  data refuse anonymous access in production; missing auth returns
  HTTP 503.
- **CORS protection** — default policy restricts origins to the
  configured deployment URL.
- **Rate limiting** — per-user and per-IP rate limiting with bounded
  memory to mitigate DoS.
- **Audit logging** — sensitive actions (`account.export`,
  `account.delete`, billing changes) are logged with userId and
  timestamp.
- **Secrets management** — encryption keys (`CREDENTIALS_ENCRYPTION_KEY`)
  and provider API keys are stored in environment variables, never in
  the database or source code.
- **Transport encryption** — TLS 1.2+ for all external traffic.
- **Vulnerability disclosure** — see `SECURITY.md` in the repository.

### 8.1 `[Self-Hosted Edition]`
You are responsible for configuring and maintaining these controls.
Ensure `CREDENTIALS_ENCRYPTION_KEY`, `AUTH_USERNAME`/`AUTH_PASSWORD`
(or NextAuth providers), TLS termination, and CORS are configured
before exposing your instance.

## 9. Children

The Service is not directed to children under 13 (or the minimum age
of digital consent in your jurisdiction). We do not knowingly collect
personal data from children under that age. If you believe a child
has provided us with personal data, contact us to request deletion.

## 10. Cookies

The Service uses only essential cookies (session, theme, locale). No
tracking, analytics, or advertising cookies are set. See the
**Cookie Policy** for details.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify
you of material changes via the Service or by email at least thirty
(30) days before the changes take effect, except where required by
law to act sooner. The "Last updated" date above indicates when the
policy was last revised.

## 12. Contact

Questions, requests, or complaints about this Privacy Policy or your
personal data may be directed to **privacy@quaesitor.local**
(placeholder — configure a monitored address for your deployment).
For the EU representative (where required by Art. 27 GDPR), contact
the same address with "EU Representative" in the subject line.
