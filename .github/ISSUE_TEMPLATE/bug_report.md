---
name: Bug Report
about: Something broken? Help us reproduce and fix it.
title: "[Bug] "
labels: ["bug", "triage"]
assignees: []
---

## Summary

<!-- One or two sentences describing the bug. -->

## What happened?

<!-- Describe what you observed. Include any error messages, stack traces, or unexpected output. Redact API keys and personal data. -->

```
Paste relevant logs or errors here. Redact API keys!
```

## What did you expect?

<!-- What did you think should have happened? -->

## How to reproduce

Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. Enter '....'
4. See error

### Minimal reproduction (if applicable)

<!-- A link to a repo, a gist, or a code snippet that reliably triggers the bug. -->

```bash
# Commands or code to reproduce
```

## Environment

Please fill in as much as you can. The more we know, the faster we can fix it.

- **Quaesitor version**: <!-- e.g. 2.5.0 — check package.json or the footer of the UI -->
- **How are you running it?**: <!-- local dev (bun run dev) | Docker | bare metal | hosted -->
- **OS**: <!-- e.g. macOS 14.5, Ubuntu 22.04, Windows 11 -->
- **Node / Bun version**: <!-- run `node -v` or `bun -v` -->
- **Browser (if UI issue)**: <!-- e.g. Chrome 128, Firefox 129, Safari 17 -->
- **Database**: <!-- SQLite (default) | Postgres -->
- **LLM provider**: <!-- NVIDIA | OpenAI | Anthropic | Ollama -->
- **Search depth**: <!-- standard | deep | advanced -->
- **Did it work before?**: <!-- Yes (which version?) | No |

## Configuration (redacted)

<!-- Paste the relevant env vars (WITHOUT VALUES). For example: -->

```env
NVIDIA_API_KEY=nvidia_***REDACTED***
DATABASE_URL=***REDACTED***
SEARCH_DEPTH=advanced
# ... any others you think are relevant
```

## Screenshots / Recordings

<!-- If it's a UI bug, drag a screenshot or screen recording here. -->

## Anything else?

<!-- Workarounds you tried, related issues, links to discussions, etc. -->

---

**Before submitting:**

- [ ] I have searched existing issues for duplicates.
- [ ] I have tested on the latest `main` branch (or the latest release).
- [ ] I have redacted all API keys, passwords, and personal data from this report.
- [ ] I have included enough information for a maintainer to reproduce the issue.
