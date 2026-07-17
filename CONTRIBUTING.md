# Contributing to Quaesitor

First off — **thank you** for taking the time to contribute. Quaesitor is built in the open, and every issue, PR, doc tweak, and skill package makes the project better for everyone.

This document explains how to get involved. If anything is unclear, please open an issue with the `question` label and we'll help you out.

---

## Table of Contents

1. [Ways to Contribute](#ways-to-contribute)
2. [Development Setup](#development-setup)
3. [Development Workflow](#development-workflow)
4. [Code Style](#code-style)
5. [Pull Request Checklist](#pull-request-checklist)
6. [Code of Conduct](#code-of-conduct)
7. [Recognition Program](#recognition-program)
8. [Reporting Security Issues](#reporting-security-issues)

---

## Ways to Contribute

You don't have to write code to help. Here are the main ways to contribute:

### 🧑‍💻 Code

- Fix a bug — browse issues labeled [`good first issue`](https://github.com/Abd123454/deep-research-engine/labels/good%20first%20issue) or [`help wanted`](https://github.com/Abd123454/deep-research-engine/labels/help%20wanted).
- Implement a feature from the [ROADMAP](ROADMAP.md).
- Improve performance — search the codebase for `// TODO: perf` or `// PERF:` comments.
- Refactor dead code — see the "Known Limitations" section in [README.md](README.md).

### 🐛 Bug Reports

Found something broken? Open a [Bug Report](https://github.com/Abd123454/deep-research-engine/issues/new?template=bug_report.md). The structured template ensures we can reproduce it quickly.

Before filing, please:
1. Search existing issues to avoid duplicates.
2. Try the latest `main` branch — your bug may already be fixed.
3. Redact any API keys from logs and screenshots.

### ✨ Feature Requests

Have an idea? Open a [Feature Request](https://github.com/Abd123454/deep-research-engine/issues/new?template=feature_request.md). Tell us the **use case** first — features without motivation tend to grow the codebase without adding value.

### 📚 Documentation

- Fix typos, clarify confusing sections, add examples — docs live in [`README.md`](README.md), [`docs/`](docs/), [`EVAL.md`](EVAL.md), and [`SECURITY.md`](SECURITY.md).
- Translate the UI — see [`src/lib/i18n/strings.ts`](src/lib/i18n/strings.ts).
- Write a blog post or tutorial — link it back here and we'll add it to the README.

### 🛠️ Skills

Quaesitor ships with a skill system (see [`src/skills/`](src/skills/)) that lets the agentic chat invoke specialized tools (PDF, DOCX, PPTX, XLSX, frontend-design, markdown). Adding a new skill is a great first contribution:

1. Create `src/skills/<your-skill>/SKILL.md` describing the skill's purpose, inputs, and outputs.
2. Implement the skill in `src/lib/skills/` (TypeScript).
3. Register it in `src/lib/skills/index.ts`.
4. Add tests in `src/lib/__tests__/`.
5. Document usage in the skill's `SKILL.md`.

Example skills to consider: `csv-analyzer`, `mermaid-renderer`, `git-diff-explainer`, `regex-tester`, `json-schema-validator`.

### 🌍 Translations

The UI is currently English-only. If you'd like to translate Quaesitor into your language, see the strings in [`src/lib/i18n/strings.ts`](src/lib/i18n/strings.ts) and the locale provider in [`src/components/i18n/locale-provider.tsx`](src/components/i18n/locale-provider.tsx). Open an issue first to coordinate.

### 💬 Community

- Answer questions in [GitHub Discussions](https://github.com/Abd123454/deep-research-engine/discussions).
- Review open PRs — a second pair of eyes always helps.
- Star the repo if you find it useful — it helps others discover the project.

---

## Development Setup

Quaesitor runs on [Bun](https://bun.sh) (recommended) or Node.js 20+.

### Prerequisites

- [Bun](https://bun.sh) >= 1.3 (or Node.js >= 20)
- [Git](https://git-scm.com/)
- A free [NVIDIA NIM API key](https://build.nvidia.com/) (primary LLM, free tier)
- Optional: [Docker](https://www.docker.com/) for the sandbox, [Playwright](https://playwright.dev/) for JS-rendered page reading

### Steps

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/deep-research-engine.git
cd deep-research-engine

# 2. Add the upstream remote
git remote add upstream https://github.com/Abd123454/deep-research-engine.git

# 3. Install dependencies
bun install

# 4. Configure environment
cp .env.example .env
# Edit .env: set NVIDIA_API_KEY (required), others optional

# 5. Generate the Prisma client (also runs automatically via postinstall)
bunx prisma generate

# 6. Start the dev server
bun run dev
```

Open http://localhost:3000 — you should see the Quaesitor UI.

### Common Commands

| Command | What it does |
|---|---|
| `bun run dev` | Start the Next.js dev server on port 3000 |
| `bun run build` | Production build (outputs to `.next/standalone/`) |
| `bun run start` | Run the production server |
| `bun run test` | Run unit + integration tests with Vitest |
| `bun run test:watch` | Watch mode for tests |
| `bun run test:coverage` | Tests with V8 coverage report |
| `bun run e2e` | Run Playwright E2E tests (requires dev server running) |
| `bun run e2e:install` | Install Playwright browser binaries (first time only) |
| `bun run lint` | Run ESLint |
| `bun run eval` | Run the evaluation harness (20 queries) |
| `bunx tsc --noEmit` | Type-check without emitting |
| `bun run worker` | Start the background worker (research jobs, memory extractor, email) |

### Environment Variables

See [`.env.example`](.env.example) for the full list. The minimum to get started:

```env
NVIDIA_API_KEY=nvidia_xxx           # required, free at build.nvidia.com
DATABASE_URL=file:./db/custom.db    # SQLite for dev
AUTH_SECRET=any-random-string       # for NextAuth session signing
```

---

## Development Workflow

1. **Sync with upstream** — `git fetch upstream && git checkout main && git merge upstream/main`.
2. **Create a branch** — `git checkout -b feat/your-feature` (or `fix/`, `docs/`, `chore/`, `test/`).
3. **Make your changes** — keep commits focused and write clear commit messages (Conventional Commits preferred: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
4. **Run lint** — `bun run lint` must pass with no errors.
5. **Run tests** — `bun run test` must pass. If you added a feature, add a test.
6. **Type-check** — `bunx tsc --noEmit` must pass (strict mode).
7. **Test manually** — exercise the new behavior through the UI at `/`.
8. **Push and open a PR** against `main`. Fill out the PR template and link any related issues.

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`
- **scope** (optional): module name, e.g. `research`, `swarm`, `vision`, `auth`
- **subject**: imperative mood, lowercase, no period

Examples:
```
feat(research): add gap-analysis retry on transient network errors
fix(vision): handle empty base64 payload from iOS Safari
docs: clarify NVIDIA_API_KEY setup in README
test(swarm): add coverage for synthesizer merge conflict
```

---

## Code Style

- **TypeScript strict mode** is enabled (`noImplicitAny: true`, `strict: true`). Do not use `any` unless absolutely necessary — prefer `unknown` with type narrowing.
- **ESLint**: the config enforces `no-unused-vars`, `prefer-const`, `no-unreachable`, etc. Fix all warnings before submitting.
- **Naming**: use descriptive function/variable names (`generatePlan`, not `genP`). Avoid abbreviations except well-known ones (`URL`, `IP`, `ID`).
- **Comments**: explain *why*, not *what*. JSDoc is welcome on exported public functions.
- **DRY**: shared helpers go in `src/lib/`. The `env()` helpers live in `src/lib/env.ts` — don't re-declare them.
- **File structure**: keep route handlers thin (`src/app/api/*/route.ts`); business logic belongs in `src/lib/`.
- **No secrets in code**: read all keys from `env()`. Never hardcode API keys, even for tests.

---

## Pull Request Checklist

- [ ] `bun run lint` passes.
- [ ] `bun run test` passes.
- [ ] `bunx tsc --noEmit` passes.
- [ ] No new `any` types introduced.
- [ ] No secrets/keys committed (`.env` stays gitignored).
- [ ] If you changed env vars, update `.env.example` too.
- [ ] If you changed behavior, update `README.md` accordingly.
- [ ] If you added a feature, add or update tests.
- [ ] If you added a new file, add it to the right `tsconfig.json` include path.
- [ ] Commit messages follow Conventional Commits.
- [ ] PR title clearly summarizes the change.

---

## Code of Conduct

By participating in this project, you agree to uphold the [Code of Conduct](https://github.com/Abd123454/deep-research-engine/blob/main/.github/CODE_OF_CONDUCT.md). In short:

- **Be respectful and inclusive.** Harassment, discrimination, and personal attacks will not be tolerated.
- **Assume good faith.** Most people are trying to help, even when they're wrong.
- **Focus on the work.** Critique ideas and code, not people.
- **Be patient with newcomers.** We were all beginners once.

Violations should be reported by opening a private security advisory or emailing the maintainer. Reports are confidential and will be reviewed promptly.

---

## Recognition Program

We believe in crediting contributors visibly and often.

### 🏆 Contributors Wall

Every contributor — whether you wrote one line or one thousand — is listed in the [Contributors section](https://github.com/Abd123454/deep-research-engine/graphs/contributors) on GitHub. We also maintain a `CONTRIBUTORS.md` (auto-generated from git history each release) inside the repo.

### 🥇 Quarterly Awards

At the end of each quarter, maintainers nominate contributors in four categories:

| Award | What it recognizes |
|---|---|
| **Patch of the Quarter** | The PR with the highest impact (bug fix, perf, or feature) |
| **Rookie of the Quarter** | Outstanding first-time contributor |
| **Docs Champion** | The most valuable documentation improvement |
| **Community Hero** | The most helpful reviewer, discussion answerer, or mentor |

Winners are announced in the [release notes](CHANGELOG.md), on the project blog, and pinned in GitHub Discussions. Each winner gets a permanent badge on their contributors entry.

### 🎁 Swag

- **First merged PR** — Quaesitor sticker pack (mailed anywhere in the world).
- **5 merged PRs** — Quaesitor t-shirt.
- **Quarterly Award winner** — Quaesitor hoodie + handwritten thank-you note from the maintainer.
- **Major milestone contributor** (e.g., shipped a roadmap item) — Quaesitor mug + a public shoutout on the project blog.

To claim swag, email the maintainer with your GitHub username and shipping address after your PR is merged. Swag is funded by [sponsorships](https://github.com/sponsors/Abd123454) — please consider sponsoring if you find the project valuable.

### 📜 Hall of Fame

Contributors who have made sustained, high-impact contributions over multiple quarters are inducted into the Hall of Fame. Inductees are listed permanently in `README.md` and receive a one-time engraved plaque.

---

## Reporting Security Issues

**Do not open a public GitHub issue for security vulnerabilities.** Instead, see [SECURITY.md](SECURITY.md) for the private disclosure process. We aim to respond within 72 hours and to publish a fix and advisory within 90 days.

---

## Questions?

- 💬 [GitHub Discussions](https://github.com/Abd123454/deep-research-engine/discussions) — for general questions and ideas.
- 🐛 [GitHub Issues](https://github.com/Abd123454/deep-research-engine/issues) — for bugs and feature requests.
- 📧 Email the maintainer — see the GitHub profile.

Happy hacking! 🚀
