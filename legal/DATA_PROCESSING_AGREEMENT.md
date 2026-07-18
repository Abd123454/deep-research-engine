# Data Processing Agreement

> **Disclaimer.** This document is a template provided by the Quaesitor
> Project for general informational purposes only. It is not legal
> advice and does not create an attorney–client relationship. Before
> relying on, publishing, or executing this document, have a qualified
> lawyer admitted in your jurisdiction review and adapt it to your
> specific deployment and applicable law, including Article 28 of the
> EU General Data Protection Regulation (Regulation (EU) 2016/679,
> "GDPR") and the UK GDPR.

**Version:** 1.0
**Last updated:** 2026-07-17
**Parties:**
- **Processor:** Quaesitor Project ("**Quaesitor**", "**Processor**",
  "**we**", "**us**")
- **Controller:** The customer or self-hosted operator identified in
  the applicable order form, deployment configuration, or sign-up
  record ("**Customer**", "**Controller**", "**you**")

This Data Processing Agreement ("**DPA**") is entered into and
incorporates by reference the Quaesitor Terms of Service and Privacy
Policy. Capitalised terms not defined here have the meaning given in
the GDPR.

---

## 1. Subject Matter, Duration, and Scope

### 1.1 Subject matter
This DPA governs the processing of personal data by Processor on
behalf of Controller in connection with Controller's use of the
Quaesitor Service (the "**Service**"), as more particularly described
in the Terms of Service and Documentation.

### 1.2 Duration
This DPA takes effect on the date Controller begins using the Service
and remains in force for the duration of the Service engagement plus
the period necessary for the return or deletion of personal data
under Section 9.

### 1.3 Nature and purpose
The Service is a self-hostable AI workstation that performs research,
agent swarm execution, code execution, vision, and voice processing.
The purpose of processing is to provide these capabilities to
Controller's authorised end-users.

### 1.4 Types of personal data
Account data, conversations, memories, documents, connector
credentials (encrypted), research jobs, artifacts, usage logs, audit
logs, and billing data, as described in the Privacy Policy.

### 1.5 Categories of data subjects
Controller's authorised end-users (employees, contractors, customers)
and any individuals whose personal data is included in User Content
uploaded by them.

### 1.6 `[Self-Hosted Edition]` Operator status
When Controller deploys the Self-Hosted Edition, Controller is both
the **controller** for its end-users and the **operator** of the
Service. The Quaesitor Project does not process any personal data on
behalf of such Controller and acts solely as a software provider under
AGPL-3.0. The remaining provisions of this DPA apply only to the
extent Quaesitor acts as a processor for Controller (e.g. in the SaaS
Edition).

## 2. Roles and Processing Instructions

### 2.1 Roles
The parties acknowledge and agree that Controller is the controller
and Processor is the processor within the meaning of Art. 28 GDPR.

### 2.2 Instructions
Processor will process personal data only on documented instructions
from Controller, including with regard to transfers of personal data
to a third country, unless required to do so by law. The Terms of
Service, this DPA, and Controller's configuration of the Service
constitute such instructions. Processor will inform Controller if, in
Processor's opinion, an instruction infringes applicable data
protection law, and may suspend performance of the infringing
instruction pending clarification.

### 2.3 Lawful basis
Controller is responsible for establishing and maintaining a lawful
basis for the processing of personal data it provides to Processor.

## 3. Confidentiality

Processor ensures that personnel authorised to process personal data
are bound by confidentiality obligations that survive termination of
their engagement. Access to personal data is limited on a
need-to-know basis and reviewed periodically.

## 4. Security Measures (Art. 32 GDPR)

Taking into account the state of the art, costs of implementation,
and the nature, scope, context, and purposes of processing, Processor
implements and maintains the following technical and organisational
measures:

1. **Encryption** — connector credentials are encrypted at rest with
   AES-256-GCM using per-record random IVs; provider API keys are
   stored in environment variables, not the database.
2. **Transport security** — TLS 1.2+ for all external traffic.
3. **Access control** — fail-closed authentication; production
   endpoints refuse anonymous access; per-user audit logging of
   sensitive actions.
4. **Network protection** — CORS restricted to configured origins;
   per-IP and per-user rate limiting with bounded memory.
5. **Logging and monitoring** — usage logs retained 90 days; audit
   logs retained 24 months.
6. **Secure development** — type checking, linting, and automated
   tests in CI; dependency scanning; security review for changes
   touching authentication, billing, or credentials.
7. **Incident response** — documented Incident Response Plan,
   including 72-hour breach notification per Art. 33 GDPR.
8. **Data minimisation** — `DELETE /api/account` performs atomic
   deletion of all user-scoped data; `GET /api/account/export`
   provides portability.

A copy of the most recent security documentation is available on
request subject to confidentiality obligations.

## 5. Sub-Processors

### 5.1 General authorisation
Controller grants Processor general authorisation to engage the
sub-processors listed in the table below. Processor remains liable
for the performance of each sub-processor to the same extent as
Processor itself.

### 5.2 Current sub-processors

| Sub-processor | Purpose | Location |
|---|---|---|
| NVIDIA NIM | LLM inference | US / EU |
| OpenAI | LLM inference, embeddings, vision | US |
| Anthropic | LLM inference | US |
| Stripe | Payment processing | US |
| Resend | Transactional email | US / EU |

### 5.3 Notice and objection
Processor will notify Controller of intended changes concerning the
addition or replacement of sub-processors at least thirty (30) days
in advance, via the Service or by email. Controller may object to a
new sub-processor on reasonable data-protection grounds by notifying
Processor in writing within that period. In such case, Processor may,
at its option: (a) cease using the sub-processor; (b) take corrective
steps to resolve Controller's objections; or (c) terminate the
affected portion of the Service with a pro-rata refund.

### 5.4 `[Self-Hosted Edition]`
Controller selects and configures its own sub-processors and is
responsible for executing DPAs with each. The list above reflects the
default providers; review and update it for your deployment.

## 6. Data Subject Rights Assistance

Taking into account the nature of the processing, Processor assists
Controller — by appropriate technical and organisational measures —
in fulfilling Controller's obligation to respond to data subject
exercises of rights under Chapters III and IV GDPR. This includes:

- **Access and portability** — the Service provides
  `GET /api/account/export` to deliver a structured, machine-readable
  JSON export of all user-scoped data.
- **Erasure** — the Service provides `DELETE /api/account` to perform
  atomic deletion of all user-scoped data, logged with an audit entry.
- **Rectification and objection** — supported via the Service UI or
  by direct request to **privacy@quaesitor.local** (placeholder).

Processor will, upon reasonable request, provide information
reasonably necessary to demonstrate compliance with Art. 28 GDPR.

## 7. Personal Data Breach Notification

### 7.1 Notification
Processor will notify Controller without undue delay, and in any
event within seventy-two (72) hours, after becoming aware of a
personal data breach affecting Controller's personal data, in
accordance with Art. 33 GDPR.

### 7.2 Content
The notification will describe the nature of the breach, the
categories and approximate number of data subjects and records
concerned, the likely consequences, the measures taken or proposed,
and the contact point for further information.

### 7.3 Cooperation
Processor will cooperate with Controller in handling the breach,
including assisting Controller in notifying the competent supervisory
authority and affected data subjects where required, and in
documenting the breach per Art. 33(5) GDPR.

## 8. Audit Rights

Controller may, at its own cost and after reasonable prior notice
(not less than fourteen (14) days), audit Processor's compliance
with this DPA, provided that the audit does not unreasonably
interfere with Processor's business operations. Audits will be
conducted during normal business hours, no more than once per
twelve-month period unless required by a supervisory authority or
following a confirmed breach.

In lieu of an on-site audit, Processor may make available
third-party audit reports, certifications (e.g. SOC 2), or summaries
of its security controls subject to confidentiality.

## 9. Data Return and Deletion on Termination

### 9.1 Return
On termination of the Service, Processor will, at Controller's
choice, return all personal data to Controller and delete existing
copies, unless applicable law requires storage. Controller may
exercise its right to receive its data via
`GET /api/account/export` at any time before or within thirty (30)
days after termination.

### 9.2 Deletion
Processor will delete all personal data within ninety (90) days of
termination, except where retention is required by law (e.g. tax
records, which are retained for seven (7) years). Processor will
provide written confirmation of deletion on request.

### 9.3 Backups
Personal data in backups will be overwritten according to the
standard backup rotation (up to 35 days) and is not separately
restorable after that period.

## 10. Cross-Border Transfers

### 10.1 SCCs
For transfers of personal data outside the EEA, UK, or Switzerland to
sub-processors located in third countries, the parties agree to the
Standard Contractual Clauses ("SCCs") adopted by the European
Commission (Decision 2021/914), the UK International Data Transfer
Addendum, and the Swiss FDPIC-recommended SCCs, each as applicable.
In the event of conflict, the SCCs prevail over this DPA.

### 10.2 Order of precedence
Where the SCCs apply, the modules are completed as follows:
Module Two (controller-to-processor) for transfers from Controller to
Processor; Module Three (processor-to-processor) for transfers from
Processor to sub-processors.

### 10.3 Supplementary measures
Processor will implement and document supplementary measures
(technical, contractual, organisational) reasonably necessary to
ensure an essentially equivalent level of protection for transferred
data.

## 11. Limitation of Liability

Each party's liability under or in connection with this DPA will be
subject to the limitations and exclusions set out in the Terms of
Service, except where such limitation is not permitted under
applicable data-protection law.

## 12. General Provisions

### 12.1 Precedence
In the event of conflict between this DPA and the Terms of Service,
this DPA prevails solely with respect to its subject matter.

### 12.2 Changes
Processor may update this DPA to reflect changes in law, supervisory
authority guidance, or its sub-processors, with at least thirty (30)
days' prior notice. Controller may terminate the Service on written
notice if it reasonably objects to a material change.

### 12.3 Contact
Notices under this DPA should be sent to **dpa@quaesitor.local**
(placeholder — configure a monitored address for your deployment).
