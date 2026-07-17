# Contributor License Agreement

> **Disclaimer.** This document is a template provided by the Quaesitor
> Project for general informational purposes only. It is not legal
> advice and does not create an attorney–client relationship. Before
> relying on, publishing, or enforcing this document, have a qualified
> lawyer admitted in your jurisdiction review and adapt it to your
> specific project structure (foundation, LLC, unincorporated
> project). In particular, the licence-back scope, patent licence, and
> sign-off process should be reviewed against your governance model.

**Version:** 1.0
**Last updated:** 2026-07-17
**Issuer:** Quaesitor Project

---

## 1. Purpose

This Contributor License Agreement ("**CLA**") sets out the terms on
which you ("**You**" or "**Contributor**") grant copyright and patent
licences to the Quaesitor Project ("**Quaesitor**", "**we**", or
"**us**") for Contributions You submit to the Quaesitor source code,
documentation, and related materials (collectively, the
"**Project**").

This CLA is modelled on the Linux kernel's Developer Certificate of
Origin process and is intended to ensure that the Project can
distribute, sublicense, and relicense the Project under the GNU
Affero General Public License v3.0 ("**AGPL-3.0**") and any future
licence approved by the Quaesitor Project maintainers.

## 2. Definitions

- "**Contribution**" means any original work of authorship, including
  any modifications or additions to existing work, that is
  intentionally submitted by You to the Project for inclusion in, or
  documentation of, any of the Project's repositories. For the
  avoidance of doubt, "submitted" includes electronic, written, oral,
  and code-review communications (e.g. GitHub pull requests, issues,
  commit messages, and mailing-list posts).
- "**Submit**" means any form of electronic, verbal, or written
  communication sent to the Project or its maintainers, including
  communications on mailing lists, source-code control systems, and
  issue trackers, but excluding communications conspicuously marked
  "Not a Contribution".

## 3. Grant of Copyright Licence

Subject to the terms and conditions of this CLA, You hereby grant to
Quaesitor a perpetual, worldwide, non-exclusive, no-charge,
royalty-free, irrevocable copyright licence to reproduce, prepare
derivative works of, publicly display, publicly perform, sublicense,
and distribute Your Contributions and such derivative works.

This licence is granted for the sole purpose of operating, improving,
and distributing the Project. It is not a transfer of ownership;
You retain all right, title, and interest in and to Your
Contributions, subject to the licence granted above.

## 4. Grant of Patent Licence

Subject to the terms and conditions of this CLA, You hereby grant to
Quaesitor a perpetual, worldwide, non-exclusive, no-charge,
royalty-free, irrevocable (except as stated in this Section) patent
licence to make, have made, use, offer to sell, sell, import, and
otherwise transfer Your Contributions, where such patent licence is
required to exercise the copyright licence granted in Section 3.

If any entity institutes patent litigation against You or any other
entity (including a cross-claim or counterclaim in a lawsuit)
alleging that a Contribution, or the Project to which such
Contribution was submitted, constitutes direct or contributory patent
infringement, then any patent licences granted to that entity under
this CLA for that Contribution or Project shall terminate as of the
date such litigation is filed.

## 5. Contributor Representations

You represent that:

1. Each Contribution is Your original work of authorship (or, if
   submitted on behalf of a third party, You have been authorised to
   submit that third party's work under this CLA).
2. You have the legal right to grant the licences in Sections 3 and 4,
   and no other person or entity has any right, title, or interest in
   or to the Contribution that would conflict with those grants.
3. Your Contributions do not, to the best of Your knowledge,
   infringe the copyrights, patents, trade secrets, trademarks, or
   other intellectual property rights of any third party.
4. You are not aware of any pending or threatened litigation,
   claim, or other action that would affect title to Your
   Contributions or the Project's right to use them.
5. You are at least thirteen (13) years of age, or the minimum age of
   digital consent in Your jurisdiction, and if You are between 13
   and the age of majority in Your jurisdiction, You represent that
   Your parent or legal guardian has reviewed and agreed to this CLA
   on Your behalf.

## 6. Disclaimer

Except for the express representations in Section 5, Your
Contributions are provided "AS IS". To the maximum extent permitted
by applicable law, Quaesitor and You disclaim all warranties,
whether express, implied, or statutory, including without limitation
any warranties of merchantability, fitness for a particular purpose,
title, or non-infringement. Quaesitor does not represent that Your
Contributions will be incorporated into the Project, that any
feedback will be acted on, or that any defects in Your Contributions
will be corrected.

## 7. Contribution Submission Process

To Submit a Contribution:

1. Fork the relevant Project repository on GitHub (or another host
   the Project designates).
2. Create a feature branch from `main`.
3. Make Your changes, with clear commit messages explaining the
   rationale.
4. Add or update tests for any behaviour change.
5. Run `bun run lint` and `bun run test` locally; both must pass.
6. Open a pull request against `main` with a description of the
   change, the issue it addresses (if any), and any
   backward-compatibility notes.
7. Sign off each commit by adding a `Signed-off-by: Your Name
   <email@example.com>` line (see Section 8).

Project maintainers review pull requests on a best-effort basis and
may request changes, reject, or defer Contributions at their
discretion. Acceptance is at the sole discretion of the Project
maintainers.

## 8. Sign-off — Developer Certificate of Origin

By adding a `Signed-off-by` line to Your commit message, You
certify the following (adapted from the Linux kernel's DCO,
v1.1):

> Developer Certificate of Origin
> Version 1.1
>
> Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
>
> Everyone is permitted to copy and distribute verbatim copies of
> this license document, but changing it is not allowed.
>
> Developer's Certificate of Origin 1.1
>
> By making a contribution to this project, I certify that:
>
> (a) The contribution was created in whole or in part by me and I
>     have the right to submit it under the open source license
>     indicated in the file; or
>
> (b) The contribution is based upon previous work that, to the
>     best of my knowledge, is covered under an appropriate open
>     source license and I have the right under that license to
>     submit that work with modifications, whether created in whole
>     or in part by me, under the same open source license (unless
>     I am permitted to submit under a different license), as
>     indicated in the file; or
>
> (c) The contribution was provided directly to me by some other
>     person who certified (a), (b) or (c) and I have not modified
>     it.
>
> (d) I understand and agree that this project and the contribution
>     are public and that a record of the contribution (including
>     all personal information I submit with it, including my
>     sign-off) is maintained indefinitely and may be redistributed
>     consistent with this project or the open source license(s)
>     involved.

To sign off automatically, configure Git:

```sh
git config user.name "Your Name"
git config user.email "you@example.com"
git commit --signoff  # or: git commit -s
```

Quaesitor maintainers will reject any pull request whose commits
lack a `Signed-off-by` line from the author. Co-authored commits
require a sign-off from each author.

## 9. Modifications

Quaesitor may modify this CLA on 30 days' notice. Contributions
Submitted after the effective date of any modification are subject
to the modified CLA. Contributions already Submitted remain under
the CLA version in effect at the time of Submission.

## 10. Contact

Questions about this CLA may be directed to
**legal@quaesitor.local** (placeholder — configure a monitored
mailbox for your deployment).
