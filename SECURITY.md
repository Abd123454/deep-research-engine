# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Cognis, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email the maintainer directly (see GitHub profile for contact info).
3. Include a clear description of the vulnerability, steps to reproduce, and the potential impact.
4. You will receive an acknowledgement within 48 hours.

## Known Security Considerations

This project is currently a **demo / personal tool**, not production-hardened. Known limitations:

- **No authentication**: any client can start research jobs. Deploy behind a firewall or add auth before public exposure.
- **In-memory job store**: jobs are lost on restart and are not shared across instances.
- **Rate limiting**: basic per-IP limits are enforced (`src/lib/rate-limit.ts`), but these are in-process only.
- **API keys**: stored in `.env` (gitignored). Never commit `.env`.
- **Prompt injection**: user queries are passed to LLMs. The system does not currently sanitize against prompt-injection attacks — treat all LLM output as untrusted.
- **External content**: pages fetched from the web are parsed as text only (HTML tags stripped); React escapes output by default. However, never render raw HTML from external sources without sanitization.

## Recommended Hardening Before Production

1. Add authentication (e.g., NextAuth.js with GitHub OAuth).
2. Move job storage to Postgres/Redis.
3. Add Redis-backed distributed rate limiting.
4. Add input sanitization for prompt-injection defense.
5. Enable CSP headers and other security headers.
6. Run behind a reverse proxy (Caddy/Nginx) with TLS.
