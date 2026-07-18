# Incident Response Plan

> **Disclaimer.** This document is a template provided by the Quaesitor
> Project for general informational purposes only. It is not legal
> advice and does not create an attorney–client relationship. Before
> relying on, publishing, or enforcing this document, have a qualified
> lawyer and a qualified security professional review and adapt it to
> your specific deployment, regulatory environment, and applicable
> law, including Article 33 of the EU General Data Protection
> Regulation (Regulation (EU) 2016/679, "GDPR").

**Version:** 1.0
**Last updated:** 2026-07-17
**Owner:** Quaesitor Project
**Contact:** **security@quaesitor.local** (placeholder — configure a
monitored, on-call address for your deployment)

---

## 1. Purpose and Scope

This Incident Response Plan ("**IRP**") describes how the Quaesitor
Project ("**Quaesitor**") prepares for, detects, responds to, and
recovers from security incidents affecting Quaesitor (the
"**Service**"). It applies to all personnel, contractors, and
sub-processors with access to production systems, user data, or
supporting infrastructure.

`[Self-Hosted Edition]` operators are responsible for adopting and
operating their own IRP for their deployments. This template may be
used as a starting point. Operators that experience an incident must
execute their own breach-notification obligations to their end-users
and supervisory authorities; the Quaesitor Project has no operational
role in self-hosted deployments.

## 2. Roles and Responsibilities

| Role | Responsibility | Primary | Secondary |
|---|---|---|---|
| **Incident Commander (IC)** | Coordinates response; declares severity; authorises actions; final authority on trade-offs | Security lead | Engineering lead |
| **Communications Lead** | Drafts internal and external notices; liaises with affected users, regulators, and media; manages timing of disclosures | Privacy lead | IC |
| **Legal Lead** | Determines notification obligations (GDPR Art. 33/34, CCPA, contracts); reviews notices; coordinates with counsel | Privacy lead | IC |
| **Forensics Lead** | Preserves evidence; performs root-cause analysis; documents timeline; assesses scope | Senior engineer | Security lead |
| **Operations Lead** | Executes containment, eradication, and recovery; manages backups, deploys fixes | DevOps engineer | Engineering lead |

The IC may consolidate roles for low-severity incidents or split
them further for severe incidents. An on-call rotation covers the IC
and Operations roles twenty-four (24) hours per day, seven (7) days
per week in production deployments.

## 3. Definitions

- **Personal data breach** — a breach of security leading to the
  accidental or unlawful destruction, loss, alteration,
  unauthorised disclosure of, or access to, personal data
  (Art. 4(12) GDPR).
- **Security incident** — any event that compromises or threatens
  the confidentiality, integrity, or availability of the Service or
  its data.
- **Affected data subject** — an individual whose personal data is
  affected by a breach.

## 4. Detection and Reporting

### 4.1 Detection sources
Incidents may be detected through:

- Automated alerts (rate-limit spikes, authentication anomalies,
  error-rate surges, Sentry events).
- Audit log reviews (`account.export`, `account.delete`, billing
  changes).
- User reports (`security@quaesitor.local`).
- Sub-processor notifications (Stripe, OpenAI, Anthropic, NVIDIA,
  Resend).
- External security researchers (per `SECURITY.md`).

### 4.2 Reporting
Anyone who suspects an incident must report it immediately to
**security@quaesitor.local** (placeholder). The recipient triages
the report within one (1) hour of receipt during business hours
and within four (4) hours outside business hours.

## 5. Classification (Severity Levels)

The IC assigns a severity level within two (2) hours of an incident
being confirmed, and re-evaluates it as new information emerges.

| Severity | Definition | Examples | Response time |
|---|---|---|---|
| **S1 — Critical** | Confirmed breach of personal data or major outage | Credential database leak; unauthorised access to user conversations; ransomware | Immediate, 24/7 |
| **S2 — High** | Likely breach or significant degradation | Prompt-injection causing mass abuse; connector-credential exposure; sub-processor outage | 1 hour, 24/7 |
| **S3 — Medium** | Localised issue with limited impact | Single-user account compromise; partial service degradation; rate-limit circumvention | 4 business hours |
| **S4 — Low** | Minor or theoretical | Suspicious-but-benign log entry; non-sensitive bug with security flavour | Next business day |

## 6. Response Lifecycle

### 6.1 Containment
The Operations Lead, under IC direction, takes immediate steps to
limit the scope and impact of the incident. Typical actions include:

- Disabling compromised accounts or API keys.
- Rotating `CREDENTIALS_ENCRYPTION_KEY` and provider API keys where
  credential exposure is suspected (note: rotation requires a
  migration script to re-encrypt existing rows; see the
  security-fixes worklog note).
- Blocking offending IPs via the rate limiter or infrastructure
  firewall.
- Suspending affected features (e.g. connectors, code sandbox).
- Failing closed on authentication (already the production default).

Containment actions are logged in the incident record with
timestamp, actor, and rationale.

### 6.2 Eradication
The Forensics Lead identifies the root cause and removes it. This
may include:

- Patching the vulnerable code path.
- Removing malicious User Content, accounts, or sessions.
- Disabling compromised sub-processors and switching to alternates.
- Rotating all secrets that may have been exposed (encryption keys,
  auth secrets, provider API keys).

### 6.3 Recovery
The Operations Lead restores normal service and verifies that the
eradication was successful:

- Deploy fixes through the standard CI/CD pipeline.
- Restore data from backups where data was lost or corrupted.
- Monitor for recurrence for at least seventy-two (72) hours after
  recovery.
- The IC declares the incident resolved only after recovery is
  verified.

### 6.4 Lessons learned
Within ten (10) business days of resolution, the Forensics Lead
produces a post-incident report covering:

- Timeline of events.
- Root cause and contributing factors.
- Scope (data subjects, records, systems affected).
- Actions taken at each stage.
- Effectiveness of detection and response.
- Recommended improvements (technical, procedural, policy) with
  owners and due dates.

The report is reviewed by the IC, Legal Lead, and Engineering Lead,
and tracked to completion.

## 7. Breach Notification (GDPR Art. 33/34)

### 7.1 Notification to controllers (where Quaesitor is a processor)
Where Quaesitor acts as a processor and an incident constitutes a
personal data breach, the Communications Lead notifies the affected
Controller(s) without undue delay and in any event within
**seventy-two (72) hours** of becoming aware of the breach, per
Art. 33(2) GDPR and Section 7 of the DPA. The notice includes:

- Nature of the breach.
- Categories and approximate number of data subjects and records.
- Likely consequences.
- Measures taken or proposed.
- Point of contact for further information.

### 7.2 Notification to supervisory authorities
Where Quaesitor is the controller (e.g. account, usage, and billing
data), the Legal Lead determines whether the breach is likely to
result in a risk to data subjects. If so, the Communications Lead
notifies the competent supervisory authority within seventy-two (72)
hours, per Art. 33(1) GDPR, using the authority's online breach
reporting form. If notification is delayed beyond 72 hours, the
reasons for the delay are provided.

### 7.3 Notification to data subjects
Where the breach is likely to result in a high risk to data
subjects, the Communications Lead notifies affected data subjects
directly without undue delay, per Art. 34 GDPR, in clear and plain
language. The notice includes the same information as in Section 7.1.

### 7.4 Documentation
All breaches (whether notifiable or not) are documented per
Art. 33(5) GDPR, including the facts, effects, and remedial action.
The documentation is retained for at least three (3) years and made
available to supervisory authorities on request.

### 7.5 Other regimes
The Legal Lead also evaluates obligations under CCPA, US state breach
notification laws, and contractual breach-notification clauses with
sub-processors and customers.

## 8. Communications

### 8.1 Internal
The IC holds a brief status update at least every four (4) hours
during S1/S2 incidents and at least once per business day during S3
incidents. Updates are recorded in the incident record.

### 8.2 External
External communications (to users, regulators, media) are drafted by
the Communications Lead, reviewed by the Legal Lead, and approved by
the IC. The Service's status page (if any) is updated within four
(4) hours of a confirmed S1/S2 incident.

### 8.3 Confidentiality
Personnel must not discuss the incident outside the response team
until the IC authorises external communication, except where
reporting to law enforcement or as required by law.

## 9. Testing and Training

- **Tabletop exercise** — at least once per twelve (12) months,
  simulating an S1 incident.
- **Awareness training** — all personnel complete security and
  privacy training on joining and annually thereafter.
- **Plan review** — this IRP is reviewed at least annually and after
  any S1 or S2 incident.

## 10. Contact

| Concern | Contact |
|---|---|
| Report an incident | **security@quaesitor.local** (placeholder) |
| Privacy / GDPR questions | **privacy@quaesitor.local** (placeholder) |
| Vulnerability disclosure | See `SECURITY.md` in the source repository |
| Law enforcement requests | **legal@quaesitor.local** (placeholder) |
