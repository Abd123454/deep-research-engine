# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Quaesitor, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email the maintainer directly (see GitHub profile for contact info).
3. Include a clear description of the vulnerability, steps to reproduce, and the potential impact.
4. You will receive an acknowledgement within 48 hours.

## Current Security Posture

Quaesitor has evolved past its demo origins into a self-hostable platform
with a layered security model. This section documents what is *actually*
implemented (as of v4.0.0), so operators can reason about the threat
model without over- or under-stating the controls.

### Authentication & Authorization

- **HTTP Basic Auth** (`AUTH_USERNAME` / `AUTH_PASSWORD`) — the original
  single-user gate. Still supported for dev / single-tenant deploys.
- **NextAuth.js v4** — full credentials provider with email + password,
  email verification, password reset flow, and SSO (OIDC + SAML) for
  enterprise. Session cookies are HttpOnly + SameSite.
- **MFA (TOTP, RFC 6238)** — per-user secrets stored in the `user_mfa`
  table, with backup codes. Enforced at the auth layer when
  `MFA_REQUIRED=true` (`requireAuth` checks the `X-MFA-Token` header).
  A legacy `MFA_SECRET` env var is supported as a single-user fallback.
- **API Keys** — long-lived bearer tokens (`/api/keys`) for the public
  API and programmatic access. Hashed at rest (bcrypt).
- **RBAC** — owner / admin / editor / viewer roles enforced via
  `src/lib/rbac.ts` + `src/lib/auth.ts` (`requireRole`).
- **Authn on routes** — `requireAuth` is wired into 60+ API routes
  (chat, research, swarm, billing, memories, documents, MCP, audit logs,
  device control, workspaces, etc.). Open routes are limited to health,
  auth login/register/forgot-password, and the Stripe webhook (which
  authenticates via signature verification instead).

### Rate Limiting

- **Redis-backed** sliding-window counter (`src/lib/rate-limit.ts`) when
  `REDIS_URL` is set — distributed across instances, survives restarts.
- **In-memory fallback** for dev / single-instance deploys (no Redis).
  Per-IP, with `MAX_MAP_SIZE` lazy pruning to bound memory.
- Honours `Retry-After`. Returns HTTP 429 on limit exceeded.

### Job Persistence

- Research jobs are persisted via `persistJob()` in
  `src/lib/research-store.ts` — every status update writes to the
  `research_jobs` table (SQLite in dev, Postgres in prod).
- Server restart → in-memory `Map` is rebuilt from DB on first access;
  completed jobs survive; in-flight jobs are marked failed on next poll.
- BullMQ (`src/lib/queue.ts`) optionally backs research / email / memory
  workers when Redis is available — queued jobs survive restarts.

### Prompt-Injection Defense

- `src/lib/prompt-security.ts` is the canonical defense layer:
  1. **Detection** — scans for prompt-injection signatures in English,
     Arabic, French, and Chinese. Unicode NFKC normalization defeats
     Cyrillic/Greek homoglyphs, zero-width spaces, soft hyphens, and
     combining diacritics.
  2. **Blocking** — suspicious patterns reject the request (HTTP 400)
     *before* the LLM ever sees the query.
  3. **Wrapping** — legitimate queries are wrapped in `<user_query>`
     XML tags so the LLM treats them as data (OWASP recommendation).
- This explicitly covers Unicode + homoglyph + multilingual
  prompt-injection attacks (audit's prior "not sanitized" claim is
  stale — that gap was closed in v3.1.0 and refined in H-7).

### Other Implemented Controls

- **SSRF protection** — `src/lib/safe-fetch.ts` blocks private IP
  ranges (RFC 1918, link-local, loopback, CGNAT, IPv4-mapped IPv6,
  NAT64) and follows redirects manually with per-hop re-validation.
- **CSRF** — double-submit cookie pattern (`src/lib/csrf.ts`) wired into
  `src/proxy.ts` for state-changing methods. NextAuth routes and the
  Stripe webhook are exempt (they have their own CSRF / signature
  protection).
- **Connector credentials** — AES-256-GCM encryption at rest
  (`src/lib/credentials.ts`); fail-closed in production.
- **Code sandbox** — disabled by default (`ENABLE_CODE_EXEC`); vm +
  Python subprocess + Docker isolation available when explicitly opted
  in.
- **Security headers** — CSP, HSTS (2yr), X-Frame-Options,
  Permissions-Policy, X-Content-Type-Options.
- **Audit logging** — 27+ sensitive actions (login, MFA, billing,
  admin access, GDPR erasure, etc.) written to the `audit_logs` table.
- **Admin IP allowlist** — `ADMIN_IP_ALLOWLIST` gates `/api/mcp` and
  `/api/audit-logs` in addition to auth.
- **Error sanitization** — `src/lib/sanitize-error.ts` strips secrets
  from error responses before they reach the client.
- **GDPR endpoints** — Art. 17 (erasure) at `DELETE /api/account`,
  Art. 20 (portability) at `GET /api/account/export`, Art. 7 (consent
  ledger) at `GET/POST /api/consent`.

## Known Security Considerations

This project is **production-usable for self-hosted deployments** but is
not yet hardened to the level of a managed SaaS. Honest limitations:

- **DNS-rebinding TOCTOU on SSRF** — there is a small race window
  between `dns.lookup()` (our IP check) and `fetch()`'s own resolution.
  Cannot be fully closed without low-level socket access (custom
  `Agent` + `lookup` hook pinning the verified IP). Documented in
  `src/lib/safe-fetch.ts`.
- **In-memory rate-limit fallback** — when Redis is unavailable, rate
  limits are per-process. A multi-instance deploy without Redis can be
  abused at `N × limit` per IP. Mitigation: set `REDIS_URL` in prod.
- **Bcryptjs vs bcrypt** — the project uses `bcryptjs` (pure JS, ~3x
  slower than native `bcrypt`). Adequate for self-hosted scale; see
  `docs/MIGRATION_NOTES.md` for the planned native-bcrypt migration.
- **next-auth v4 on Next.js 16** — works, but v4 was designed for
  Next.js 12-14. Auth.js v5 is the recommended upgrade path (see
  `docs/MIGRATION_NOTES.md`).
- **Dev-dependency vulnerabilities** — `vite`, `minimatch` (via
  eslint/vitest/prisma dev tools) have HIGH advisories. These are
  dev-only deps, not in production runtime.
- **Code sandbox is opt-in** — disabled by default in dev AND prod.
  Operators who enable it should review the threat model in
  `src/lib/code-sandbox.ts` and prefer the Docker isolation path.
- **API keys are long-lived** — no automatic rotation. Operators should
  rotate manually via `/api/keys` on personnel changes.
- **External content** — pages fetched from the web are parsed as text
  (HTML tags stripped). Mermaid SVG output is sanitized via DOMPurify
  with `svg` + `svgFilters` profiles only (no `html`). Never render raw
  HTML from external sources without sanitization.

## Recommended Hardening Before Public Exposure

Most items from the prior audit checklist are now done. Remaining
recommendations:

1. **Set `REDIS_URL`** in production — enables distributed rate
   limiting + BullMQ background workers.
2. **Set `NEXTAUTH_SECRET`** to a strong random value
   (`openssl rand -base64 32`) — required for production auth.
3. **Set `MFA_REQUIRED=true`** for any multi-user deploy.
4. **Set `CREDENTIALS_ENCRYPTION_KEY`** — without it, connector
   credentials fail-closed (no encryption in prod without a key).
5. **Run behind a reverse proxy** (Caddy/Nginx) with TLS, and set
   `TRUSTED_PROXY_HOPS` to match your proxy chain so `getClientIP`
   parses `X-Forwarded-For` correctly.
6. **Keep `ENABLE_CODE_EXEC` unset** unless you have reviewed the code
   sandbox threat model and configured Docker isolation.
7. **Configure Sentry** (`SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
   for production error monitoring.
