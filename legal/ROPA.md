# Record of Processing Activities (RoPA)

> **Disclaimer.** This document is a template provided by the Quaesitor
> Project for general informational purposes only. It is not legal
> advice and does not create an attorney–client relationship. Before
> relying on, publishing, or enforcing this document, have a qualified
> lawyer admitted in your jurisdiction review and adapt it to your
> specific deployment and applicable law, including Article 30 of the
> EU General Data Protection Regulation (Regulation (EU) 2016/679,
> "GDPR").

**Version:** 1.0
**Last updated:** 2026-07-17
**Controller (SaaS Edition):** Quaesitor Project
**Controller (Self-Hosted Edition):** You (the operator)
**Data Protection Officer / Contact:** **privacy@quaesitor.local**
(placeholder — configure a monitored address for your deployment)

---

## 1. About This Record

This Record of Processing Activities ("**RoPA**") is maintained
pursuant to Article 30 GDPR. It describes each processing activity
carried out by or on behalf of the Quaesitor Project in connection
with the Quaesitor Service (the "**Service**").

`[Self-Hosted Edition]` operators are themselves the controller for
their deployment and must maintain their own RoPA. This template may
be used as a starting point but must be reviewed and updated to
reflect the operator's actual processing activities, sub-processors,
and retention practices.

## 2. Identity of the Controller and Processor

| | SaaS Edition | Self-Hosted Edition |
|---|---|---|
| **Controller** | Quaesitor Project | Operator |
| **Processor** (for User Content) | Quaesitor Project | Operator (runs the Service) |
| **Contact** | privacy@quaesitor.local | Operator-defined |
| **EU Representative** (Art. 27, if applicable) | Designated via privacy@quaesitor.local | Operator-defined |

## 3. Processing Activities

| # | Purpose of Processing | Data Categories | Data Subjects | Recipients | Retention | Security Measures |
|---|---|---|---|---|---|---|
| 1 | **Conversations** — store, recall, and route prompts and completions to LLM providers | Message text, role, model, timestamps, attachments | Users of the Service | NVIDIA NIM, OpenAI, Anthropic, Ollama (per provider routing); stored on Quaesitor infrastructure | Until user-initiated deletion via `DELETE /api/account` | TLS in transit; fail-closed auth; per-user isolation; audit logging |
| 2 | **Memories** — long-term facts extracted from conversations for recall | Subject, predicate, object, access count, last accessed, embeddings | Users of the Service | Embeddings provider (OpenAI or local); stored on Quaesitor infrastructure | Until user-initiated deletion | TLS; AES-256-GCM at rest (where applicable); per-user isolation |
| 3 | **Documents** — parse, store, embed, and retrieve uploaded or generated documents | Filename, parsed text, embeddings, source tier, content | Users of the Service | Embeddings provider; stored on Quaesitor infrastructure | Until user-initiated deletion | TLS; per-user isolation; size limits; sandboxed parsing |
| 4 | **Connectors** — store and use third-party service credentials (e.g. GitHub tokens) | OAuth tokens, personal access tokens, connector metadata | Users of the Service | Connector target (GitHub, etc.); not shared with other sub-processors | Until user-initiated deletion of the connector | **AES-256-GCM encryption at rest**; per-record random IV; key from `CREDENTIALS_ENCRYPTION_KEY`/`AUTH_PASSWORD`; audit logging |
| 5 | **Billing** — process payments, manage subscriptions, issue receipts | Plan, Stripe customer ID, invoices, last 4 digits of card, billing address | Users of the Service (SaaS Edition only) | Stripe (payment processor); accounting/tax records | **7 years** (tax retention obligation) | Stripe PCI-DSS compliance; no full card data stored by Quaesitor; TLS; audit logging |
| 6 | **Usage logs** — operate, secure, and debug the Service | IP address, request path, status code, user agent, timestamp, userId | Users of the Service | Quaesitor infrastructure; sub-processors as needed for log management | **90 days** | TLS; access-controlled; aggregated for analytics where feasible |
| 7 | **Audit logs** — record sensitive actions for accountability and security investigation | Action type (`account.export`, `account.delete`, billing changes), userId, timestamp, metadata | Users of the Service | Quaesitor infrastructure; supervisory authorities on lawful request | **24 months** | TLS; append-only; access-controlled |
| 8 | **Research jobs** — perform deep-research tasks: plan, sub-queries, sources, report | Query, plan, sub-queries, retrieved source text, citations, status, artifacts | Users of the Service | Web sources (page-reader fetches); LLM providers; Quaesitor infrastructure | Until user-initiated deletion | TLS; per-user isolation; sandboxed page-reader; prompt-injection filtering |
| 9 | **Artifacts** — generate and store files (documents, slides, images, code, audio) | File content, type, size, storage path, generation metadata | Users of the Service | Storage provider (local filesystem or object storage); LLM providers for generation | Until user-initiated deletion | TLS; per-user isolation; size quotas |
| 10 | **Account management** — register, authenticate, and manage user identity | Email, hashed password, name (optional), role, registration timestamp | Users of the Service | Email provider (Resend) for verification and notifications; Quaesitor infrastructure | Until account deletion | TLS; bcrypt/argon2 password hashing (per NextAuth config); fail-closed auth; rate limiting |
| 11 | **Transactional email** — send welcome, password reset, billing receipts, research-complete | Email address, message content, delivery status | Users of the Service | Resend | 90 days (Resend retention); Quaesitor logs 90 days | TLS; opt-out for non-essential email; SPF/DKIM/DMARC |
| 12 | **Service improvement** — debug defects and evaluate quality | Aggregated/anonymised metrics; User Content only with explicit opt-in | Users of the Service (aggregated) | Quaesitor engineering; no third-party analytics | 90 days for raw; aggregated/anonymised indefinitely | Aggregation before analysis; access-controlled; no cross-user correlation without consent |

## 4. Sub-Processors

The following sub-processors may receive personal data in connection
with the processing activities above. Sub-processor changes are
governed by the DPA Section 5.

| Sub-processor | Activities supported | Location | Transfer mechanism |
|---|---|---|---|
| NVIDIA NIM | LLM inference (Activity 1, 2, 3, 8, 9) | US / EU | SCCs; DPF where certified |
| OpenAI | LLM inference, embeddings, vision (Activities 1, 2, 3, 8, 9) | US | SCCs; DPF |
| Anthropic | LLM inference (Activities 1, 8, 9) | US | SCCs; DPF |
| Stripe | Payment processing (Activity 5) | US | SCCs; DPF; PCI-DSS |
| Resend | Transactional email (Activity 11) | US / EU | SCCs; DPF |
| GitHub (user-enabled connector) | Source-control access (Activity 4) | US | Per GitHub terms; user-authorised |

## 5. Cross-Border Transfers

Where personal data is transferred to a sub-processor outside the
EEA, UK, or Switzerland, the transfer is governed by Standard
Contractual Clauses, the UK International Data Transfer Addendum,
and the Swiss FDPIC-recommended SCCs as applicable, supplemented by
the EU-US Data Privacy Framework certifications of sub-processors
that participate. See DPA Section 10 for details.

## 6. Review and Updates

This RoPA is reviewed at least every twelve (12) months and
whenever a new processing activity, sub-processor, or purpose is
introduced. Material changes are versioned and retained for the
duration of the processing plus the applicable retention period.

## 7. Contact

Questions about this RoPA may be directed to
**privacy@quaesitor.local** (placeholder — configure a monitored
address for your deployment).
