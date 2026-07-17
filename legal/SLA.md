# Service Level Agreement

> **Disclaimer.** This document is a template provided by the Quaesitor
> Project for general informational purposes only. It is not legal
> advice and does not create an attorney–client relationship. Before
> relying on, publishing, or enforcing this document, have a qualified
> lawyer admitted in your jurisdiction review and adapt it to your
> specific deployment, customer base, and applicable law. Service-level
> commitments in commercial contracts frequently require negotiation of
> liability caps, exclusions, and remedy windows that this template
> does not address.

**Version:** 1.0
**Last updated:** 2026-07-17
**Issuer:** Quaesitor Project

---

## 1. Overview

This Service Level Agreement ("**SLA**") governs the availability of
the Quaesitor hosted Software-as-a-Service edition (the "**SaaS
Edition**") and applies to subscribers on a paid plan
("**Subscribers**"). For the self-hosted edition (the "**Self-Hosted
Edition**"), the Quaesitor Project makes no availability commitments;
see Section 8.

Capitalised terms not defined here have the meaning given in the
Terms of Service. This SLA is incorporated by reference into the
Terms of Service.

## 2. Service Availability Target

The Quaesitor Project endeavours to make the SaaS Edition available
with a Monthly Uptime Percentage of at least **99.5%** (the "**Service
Level**"). The Service Level is measured on a calendar-month basis,
excluding Scheduled Maintenance (Section 5) and the events listed in
Section 9 (Exclusions).

### 2.1 Monthly Uptime Percentage

`Monthly Uptime Percentage = (Available Minutes − Downtime Minutes) / Available Minutes × 100`

- **Available Minutes** = total minutes in the calendar month, minus
  Scheduled Maintenance Minutes.
- **Downtime Minutes** = total minutes in the month during which the
  Service is Unavailable.
- "**Unavailable**" means the Service returns an HTTP 5xx error or
  fails to respond to authenticated `/api/health` requests for more
  than 60 consecutive seconds. Transient errors under 60 seconds and
  HTTP 4xx errors caused by client misconfiguration are **not**
  Downtime.

## 3. Uptime Calculation Method

Uptime is monitored from at least two geographically distinct probe
locations. A minute is counted as Downtime only when **both** probes
record consecutive failures for that minute. This avoids counting
single-probe network glitches as Service Downtime.

The current uptime status, historic uptime, and active incidents are
published at `https://status.quaesitor.local` (placeholder —
configure a monitored status page for your deployment).

## 4. Incident Response Times

The Quaesitor Project classifies incidents by Severity and targets
the following response times:

| Severity | Definition | First Response | Mitigation Target |
|---|---|---|---|
| **P1 — Critical** | Service is Unavailable to all Subscribers; no workaround exists. | 1 hour (24×7) | 4 hours |
| **P2 — Major** | Core functionality (research, chat, billing) is degraded for many Subscribers; partial workaround exists. | 4 hours (business hours) | 8 business hours |
| **P3 — Minor** | Non-core functionality is degraded; isolated Subscribers affected; full workaround exists. | 24 hours (business hours) | Best-effort next release |

"**First Response**" means a human operator has acknowledged the
incident and begun investigation. "**Mitigation Target**" means the
target time to restore Service availability via fix, failover, or
workaround. These are targets, not guarantees.

### 4.1 Reporting an Incident

Subscribers may report incidents via:

- Email: `support@quaesitor.local` (placeholder — configure a
  monitored mailbox).
- In-product feedback widget.
- For P1 incidents only, telephone the on-call number provided to
  Enterprise plan Subscribers.

## 5. Scheduled Maintenance

The Quaesitor Project performs routine maintenance (OS patches,
database migrations, dependency upgrades) on a published schedule.
Maintenance is classified as:

- **Standard Maintenance:** performed during the published maintenance
  window (Sundays 02:00–04:00 UTC). No individual notice required.
- **Significant Maintenance:** may cause up to 30 minutes of
  Downtime. Notice posted to the status page at least **48 hours** in
  advance.
- **Emergency Maintenance:** required to address an active security
  incident or imminent Service failure. Best-effort notice posted as
  soon as the maintenance is scheduled; no minimum notice window.

Scheduled Maintenance Minutes are excluded from the Monthly Uptime
Percentage calculation.

## 6. Service Credits

If the Service Level is not met in a calendar month, the Subscriber
is entitled to a Service Credit calculated as a percentage of the
fees paid for the affected month, as follows:

| Monthly Uptime Percentage | Service Credit |
|---|---|
| < 99.5% but ≥ 99.0% | 10% of monthly fees |
| < 99.0% but ≥ 95.0% | 25% of monthly fees |
| < 95.0% | 50% of monthly fees |

### 6.1 Claim Process

To receive a Service Credit, the Subscriber must:

1. Submit a claim to `billing@quaesitor.local` within **30 days** of
   the end of the affected month.
2. Include the Subscriber's account email, the affected month, and a
   description of the Downtime observed.
3. Authorise the Quaesitor Project to verify the claim against its
   internal monitoring data.

Approved Service Credits are applied to the Subscriber's next
invoice. Service Credits are the Subscriber's sole and exclusive
remedy for any Downtime or failure to meet the Service Level.

## 7. Support Channels

| Plan | Channel | Response Time |
|---|---|---|
| Free | Community forum, in-product feedback | Best-effort |
| Pro | Email support, in-product chat | 1 business day (P3) |
| Enterprise | Email + phone + dedicated Slack channel | Per contract |

Support is provided in English during the hours published on the
status page, except for P1 incidents which are handled 24×7 for
Enterprise Subscribers.

## 8. Self-Hosted Edition

`[Self-Hosted Edition]` This SLA does **not** apply to the
Self-Hosted Edition. The Quaesitor Project makes no availability,
performance, or support commitments for deployments it does not
operate. Self-hosted operators are responsible for:

- Monitoring their own uptime.
- Scheduling their own maintenance windows.
- Providing their own incident response and support.
- Backing up their own data (see Section 9 of the Privacy Policy).

The Quaesitor Project may, at its discretion, provide best-effort
community support via GitHub Issues and pull requests.

## 9. Exclusions

The Service Level does not apply to Downtime caused by:

1. **Force majeure** events: natural disasters, war, terrorism, civil
   unrest, government action, pandemic, labour disputes not under the
   Quaesitor Project's control.
2. **User-caused issues:** misconfiguration, credential compromise,
   exceeding plan limits, abusive traffic patterns, or any action
   that violates the Acceptable Use Policy.
3. **Third-party provider outages:** failures of upstream LLM
   providers (NVIDIA NIM, OpenAI, Anthropic), payment processors
   (Stripe), email providers (Resend), search engines, or cloud
   infrastructure providers — **except** where the Quaesitor Project
   has a contractual SLA with that provider and could have mitigated
   via failover.
4. **Scheduled Maintenance** (Section 5).
5. **Client-side issues:** network connectivity between the
   Subscriber's location and the Service that are outside the
   Quaesitor Project's infrastructure.
6. **Beta or preview features:** explicitly labelled as such in the
   Service.

## 10. Modifications

The Quaesitor Project may modify this SLA on 30 days' notice. If a
modification materially reduces the Service Level or remedy, paid
Subscribers may cancel their subscription and receive a pro-rata
refund of prepaid fees for the remaining term.

## 11. Contact

Questions about this SLA may be directed to
**support@quaesitor.local** (placeholder — configure a monitored
mailbox for your deployment).
