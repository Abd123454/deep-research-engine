# Cookie Policy

> **Disclaimer.** This document is a template provided by the Quaesitor
> Project for general informational purposes only. It is not legal
> advice and does not create an attorney–client relationship. Before
> relying on, publishing, or enforcing this document, have a qualified
> lawyer admitted in your jurisdiction review and adapt it to your
> specific deployment and applicable law, including the EU ePrivacy
> Directive (Directive 2002/58/EC), the UK Privacy and Electronic
> Communications Regulations (PECR), and applicable state laws.

**Version:** 1.0
**Last updated:** 2026-07-17
**Issuer:** Quaesitor Project

---

## 1. Overview

Quaesitor (the "**Service**") uses only **essential cookies** required
for the Service to function. We do **not** use tracking, analytics,
advertising, or cross-site cookies. This Cookie Policy explains what
cookies are set, why, and for how long.

`[Self-Hosted Edition]` operators are responsible for any additional
cookies set by their deployment, including by analytics tools,
fonts, or third-party widgets they choose to integrate. Review your
deployment's actual cookie usage and update this policy accordingly.

## 2. What Are Cookies?

Cookies are small text files stored on your device by your browser
when you visit a website. Cookies allow the Service to remember your
session, preferences, and similar state across page loads. The
Service also uses `localStorage` and `sessionStorage` for the same
purposes; references to "cookies" in this policy include those
storage mechanisms where the context applies.

## 3. Cookies We Use

### 3.1 Essential cookies

Essential cookies are required for the Service to function. They
cannot be disabled in the Service's settings, although you may delete
them from your browser at any time (see Section 5).

| Cookie / storage | Purpose | Duration | Type |
|---|---|---|---|
| `__Secure-next-auth.session-token` | Maintains your authenticated session across page loads | Session (cleared on browser close) | Essential |
| `__Host-csrf-token` | Cross-Site Request Forgery protection for forms and API calls | Session | Essential |
| `theme` | Remembers your light/dark theme preference | 1 year | Essential (preference) |
| `locale` | Remembers your language and locale preference | 1 year | Essential (preference) |
| `depth` | Remembers your default research depth selection | 1 year | Essential (preference) |
| `lastProjectId` | Remembers the project you last opened for faster return | 90 days | Essential (preference) |

### 3.2 What we do **not** set

- No **analytics** cookies (no Google Analytics, Plausible, Fathom,
  PostHog, or similar).
- No **advertising** cookies (no Google Ads, Meta Pixel, or similar).
- No **third-party tracking** cookies (no segments, hotjar, fullstory).
- No **social-media** widgets that drop cookies.
- No **CDN** cookies (we use cookieless CDNs where applicable).

## 4. Consent

Under the EU ePrivacy Directive and PECR, **essential cookies do not
require prior consent**. Because Quaesitor only uses essential
cookies, the Service does not display a cookie consent banner.

If a future version of the Service introduces non-essential cookies
(e.g. optional analytics), we will:

1. Display a clear, granular consent banner on first visit.
2. Allow you to accept or reject each category of non-essential
   cookie.
3. Honour your choice across sessions and provide a way to change it
   via Settings → Privacy.
4. Update this Cookie Policy to list each non-essential cookie with
   its purpose, duration, and provider.

## 5. Managing Cookies

You can manage or delete cookies at any time through your browser
settings:

- **Chrome:** Settings → Privacy and security → Cookies and other
  site data.
- **Firefox:** Settings → Privacy & Security → Cookies and Site Data.
- **Safari:** Preferences → Privacy → Cookies and website data.
- **Edge:** Settings → Cookies and site permissions.

Blocking or deleting the session cookie will sign you out of the
Service. Blocking the preference cookies will reset your theme,
locale, and other preferences to defaults on each visit.

## 6. Cookie Policy Updates

We may update this Cookie Policy from time to time to reflect changes
in the cookies we use or in applicable law. The "Last updated" date
above indicates when the policy was last revised. If we introduce
non-essential cookies, we will notify you via the Service or by email
at least thirty (30) days before they take effect.

## 7. Contact

Questions about this Cookie Policy may be directed to
**privacy@quaesitor.local** (placeholder — configure a monitored
address for your deployment).
