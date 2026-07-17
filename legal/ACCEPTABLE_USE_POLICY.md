# Acceptable Use Policy

> **Disclaimer.** This document is a template provided by the Quaesitor
> Project for general informational purposes only. It is not legal
> advice and does not create an attorney–client relationship. Before
> relying on, publishing, or enforcing this document, have a qualified
> lawyer admitted in your jurisdiction review and adapt it to your
> specific deployment and applicable law.

**Version:** 1.0
**Last updated:** 2026-07-17
**Issuer:** Quaesitor Project

---

## 1. Purpose and Scope

This Acceptable Use Policy ("**AUP**") sets out the rules governing
your use of Quaesitor (the "**Service**"). It is incorporated by
reference into the Terms of Service. Capitalised terms have the
meaning given in the Terms of Service.

This AUP applies to all users of the Service, including the SaaS
Edition and the Self-Hosted Edition. `[Self-Hosted Edition]` operators
are responsible for enforcing this AUP (or their equivalent policy)
against their end-users.

## 2. Prohibited Uses

You will not, and will not permit any end-user to, use the Service to:

### 2.1 Illegal content
Generate, store, transmit, or display content that is illegal under
applicable law, including content that promotes terrorism, violence,
illegal drugs, or illegal weapons activities.

### 2.2 Malware and malicious code
Generate, distribute, or execute malware, ransomware, spyware, or any
other malicious code, including via the Service's code-execution
sandbox. Attempting to use the sandbox to attack the host, escape
container boundaries, or pivot to other services is prohibited.

### 2.3 Attacks against the Service
Attempt or perform prompt-injection, jailbreak, or other attacks
against the Service's safety controls, model providers, or
infrastructure; probe, scan, or test the vulnerability of the Service
or any third-party system without authorisation; or interfere with
the Service's authentication, rate limiting, logging, or access
controls.

### 2.4 Harassment and abuse
Harass, stalk, threaten, intimidate, or defame any person; generate
content that incites hatred or discrimination against individuals or
groups based on race, ethnicity, religion, gender, sexual
orientation, disability, or other protected characteristic.

### 2.5 CSAM
Generate, distribute, store, or facilitate access to child sexual
abuse material (CSAM), including realistic depictions of minors.
Quaesitor will report any detected CSAM to the relevant authorities
(National Center for Missing & Exploited Children in the US, or
equivalent national authority) and will permanently ban offending
accounts.

### 2.6 Doxxing
Collect, aggregate, or publish another person's personal information
without consent, including home address, phone number, government
identifiers, financial information, or location data.

### 2.7 Intellectual property infringement
Upload, generate, or distribute content that infringes the
copyright, trademark, trade secret, or other intellectual property
rights of any third party. Quaesitor will respond to valid DMCA
takedown notices (see the contact section).

### 2.8 Scraping and competing models
Scrape, mine, or otherwise extract outputs of the Service for the
purpose of training, fine-tuning, or evaluating competing AI models,
except where explicitly authorised in writing.

### 2.9 Reverse engineering
Reverse engineer, decompile, disassemble, or otherwise attempt to
derive the source code of the Service, except to the extent permitted
by AGPL-3.0 or applicable law that cannot be excluded by contract.

### 2.10 Bypassing controls
Circumvent, disable, or otherwise tamper with rate limits, content
filters, plan limits, authentication, encryption, logging, or other
controls of the Service.

### 2.11 Account sharing
Share account credentials, API keys, or authentication tokens with
third parties, or resell access to the Service except as expressly
permitted by your plan.

### 2.12 Unsolicited communications
Use the Service to send unsolicited commercial communications, spam,
or phishing messages, or to harvest email addresses or other contact
data without consent.

### 2.13 Privacy violations
Submit personal data of third parties without a lawful basis,
including data obtained through unauthorised scraping, breaches, or
theft.

### 2.14 Other unlawful activity
Use the Service in any manner that could damage, disable, overburden,
or impair the Service or interfere with any other party's use; or in
any manner that violates applicable law or third-party rights.

## 3. Special Rules for Code Execution

The Service provides a sandboxed code-execution environment. You
agree to:

- Use the sandbox only for tasks that further your legitimate use of
  the Service (research, artifact generation, data analysis).
- Not attempt to escape the sandbox, access host resources, or attack
  other tenants.
- Not use the sandbox to mine cryptocurrency or perform other
  resource-intensive operations unrelated to your tasks.
- Not deploy persistent servers, bots, or daemons from the sandbox.

## 4. Special Rules for Connectors

When you connect third-party services (e.g. GitHub) via the connectors
feature, you represent that you have the right to access those
services and that your use complies with their terms of service.
Connector credentials are encrypted at rest with AES-256-GCM, but
you remain responsible for managing token scopes, expiry, and
revocation at the third-party service.

## 5. Enforcement

### 5.1 Investigation
Quaesitor may investigate suspected violations of this AUP, including
by reviewing User Content, audit logs, and usage patterns. We will
cooperate with law-enforcement and regulatory authorities as required
by law.

### 5.2 Remedies
Violations may result in, at our discretion and proportional to the
severity:

- **Warning** — a written notice describing the violation and required
  corrective action.
- **Content removal** — deletion of violating User Content.
- **Suspension** — temporary suspension of account access.
- **Termination** — permanent termination of the account under
  Section 11 of the Terms of Service.
- **Legal action** — referral to law enforcement or civil/criminal
  proceedings, including for CSAM, prompt-injection attacks against
  critical infrastructure, and large-scale IP infringement.

### 5.3 `[Self-Hosted Edition]`
The Quaesitor Project cannot enforce this AUP against your
end-users. You are responsible for adopting and enforcing an
equivalent policy for your deployment.

## 6. Reporting Abuse

To report a violation of this AUP, contact
**abuse@quaesitor.local** (placeholder — configure a monitored
address for your deployment). Please include:

- A description of the violation.
- The specific User Content, conversation, or artifact identifier
  (if known).
- The date and time of the violation.
- Any supporting evidence (screenshots, logs).

We will acknowledge receipt within forty-eight (48) hours and
investigate credible reports promptly. False or malicious reports
may themselves be treated as violations of this AUP.

### 6.1 DMCA takedowns
Copyright owners who believe their work has been infringed may submit
a DMCA notice to **dmca@quaesitor.local** (placeholder) including the
information required by 17 U.S.C. § 512(c)(3).

## 7. Changes to This AUP

We may update this AUP from time to time. We will provide notice of
material changes via the Service or by email. Continued use after
the effective date constitutes acceptance of the revised AUP.

## 8. Contact

Questions about this AUP may be directed to
**abuse@quaesitor.local** (placeholder).
