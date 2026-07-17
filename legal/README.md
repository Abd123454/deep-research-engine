# Quaesitor — Legal Documents

> **Disclaimer.** The documents in this directory are **templates**
> provided by the Quaesitor Project for general informational purposes
> only. They are **not legal advice** and do not create an
> attorney–client relationship. Before relying on, publishing, or
> enforcing any of them, have a qualified lawyer admitted in your
> jurisdiction review and adapt them to your specific deployment,
> customer base, and applicable law, including the EU General Data
> Protection Regulation (Regulation (EU) 2016/679, "GDPR"), the UK
> GDPR, the California Consumer Privacy Act (Cal. Civ. Code
> § 1798.100 et seq., "CCPA"), the EU ePrivacy Directive, and any
> other applicable data-protection, consumer-protection, and
> electronic-transactions laws.

**Version:** 1.0
**Last updated:** 2026-07-17
**Issuer:** Quaesitor Project

---

## Index

| # | Document | Purpose | Last updated |
|---|---|---|---|
| 1 | [Terms of Service](./TERMS_OF_SERVICE.md) | Governs use of the Service (SaaS & Self-Hosted Editions) | 2026-07-17 |
| 2 | [Privacy Policy](./PRIVACY_POLICY.md) | Describes data collection, use, rights, and security (GDPR + CCPA) | 2026-07-17 |
| 3 | [Data Processing Agreement](./DATA_PROCESSING_AGREEMENT.md) | Art. 28 GDPR DPA between Controller and Processor | 2026-07-17 |
| 4 | [Acceptable Use Policy](./ACCEPTABLE_USE_POLICY.md) | Rules for acceptable use and prohibited conduct | 2026-07-17 |
| 5 | [Cookie Policy](./COOKIE_POLICY.md) | Lists cookies used (essential only) and consent approach | 2026-07-17 |
| 6 | [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md) | Detection, classification, response, and breach notification | 2026-07-17 |
| 7 | [Record of Processing Activities (RoPA)](./ROPA.md) | Art. 30 GDPR record of processing activities | 2026-07-17 |

## How to Use These Documents

### For SaaS deployments operated by the Quaesitor Project

These documents are written primarily for the SaaS Edition operated
by the Quaesitor Project. The Project is the data controller for
account, usage, and billing data, and a data processor for User
Content. Configure the placeholder contact addresses
(`legal@quaesitor.local`, `privacy@quaesitor.local`,
`security@quaesitor.local`, `abuse@quaesitor.local`,
`dpa@quaesitor.local`, `dmca@quaesitor.local`) to monitored
mailboxes before publishing.

### For Self-Hosted deployments

Each document contains `[Self-Hosted Edition]` notes calling out
where the operator (you) assumes responsibilities that the
Quaesitor Project holds for the SaaS Edition. Specifically:

- **You are the data controller** for all personal data in your
  deployment, including your end-users' conversations, memories,
  documents, and connectors.
- **You are the operator** of the Service, responsible for
  authentication, encryption keys (`CREDENTIALS_ENCRYPTION_KEY`),
  TLS, CORS, backups, network exposure, and incident response.
- **You select your sub-processors** (NVIDIA NIM, OpenAI,
  Anthropic, Ollama, Stripe, Resend, and any connectors). Update
  the sub-processor lists in the Privacy Policy, DPA, and RoPA to
  match the providers you have actually enabled.
- **You must publish your own notices** to your end-users. These
  templates are a starting point, not a substitute.

### Before going live

1. Have a qualified lawyer review each document for your
   jurisdiction.
2. Replace every placeholder contact address
   (`*@quaesitor.local`) with a monitored mailbox.
3. Replace "Quaesitor Project" with your legal entity name where
   appropriate.
4. Update the sub-processor tables to reflect the providers you
   have actually enabled.
5. Update retention periods to match your operational configuration
   if different from the defaults (e.g. log rotation, backup
   retention).
6. Confirm the API endpoints referenced (`DELETE /api/account`,
   `GET /api/account/export`) are reachable from your deployment
   URL.
7. Set the "Last updated" date to the date you publish.

## Related Documents

- `../SECURITY.md` — Vulnerability disclosure and security
  practices for the source code.
- `../LICENSE` — AGPL-3.0 license for the source code.
- `../README.md` — Project overview and setup instructions.
- `../docs/adr/` — Architecture Decision Records.

## Contact

For questions about these documents, contact
**legal@quaesitor.local** (placeholder — configure a monitored
address for your deployment). For privacy requests, use
**privacy@quaesitor.local**. For security incidents, use
**security@quaesitor.local**.
