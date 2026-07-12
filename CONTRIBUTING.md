# Contributing to Deep Research Engine

Thank you for your interest in contributing! This project welcomes contributions of all kinds.

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env` and fill in your API keys.
4. Start the dev server: `bun run dev`
5. Open http://localhost:3000

## Development Workflow

1. Create a branch: `git checkout -b feat/your-feature` or `fix/your-bugfix`.
2. Make your changes. Keep commits focused and write clear commit messages.
3. Run lint: `bun run lint` — must pass with no errors.
4. (If adding a feature) test manually via the UI at `/`.
5. Push and open a Pull Request against `main`.

## Code Style

- **TypeScript strict mode** is enabled (`noImplicitAny: true`, `strict: true`). Do not use `any` unless absolutely necessary — prefer `unknown` with type narrowing.
- **ESLint**: the config enforces `no-unused-vars`, `prefer-const`, `no-unreachable`, etc. Fix all warnings before submitting.
- **Naming**: use descriptive function/variable names (`generatePlan`, not `genP`). Avoid abbreviations except well-known ones (`URL`, `IP`).
- **Comments**: explain *why*, not *what*. JSDoc is welcome on exported public functions.
- **DRY**: shared helpers go in `src/lib/`. The `env()` helpers live in `src/lib/env.ts` — don't re-declare them.

## Areas That Need Help

- 🧪 **Tests**: unit tests for `extractQuestionsJson`, `htmlToText`, `tryParsePlan`, `dedupeSources`, `stageProgress`. (Currently zero test coverage.)
- 🌍 **i18n**: the UI is English-only. `next-intl` is available as a dependency.
- 📄 **PDF export**: only `.md` export exists. A PDF export would be valuable.
- 🔌 **Backend interfaces**: abstracting `LLMBackend`, `SearchBackend`, `PageReaderBackend`, `JobStore` behind interfaces for easier extensibility.
- 📊 **Quota tracking**: a Prisma-backed `ApiUsage` table to track NVIDIA/Tavily consumption.

## Pull Request Checklist

- [ ] `bun run lint` passes.
- [ ] No new `any` types introduced.
- [ ] No secrets/keys committed (`.env` stays gitignored).
- [ ] If you changed env vars, update `.env.example` too.
- [ ] If you changed behavior, update `README.md` accordingly.

## Reporting Issues

Open a GitHub issue with:
- Clear title and description.
- Steps to reproduce.
- Expected vs. actual behavior.
- Relevant logs (redact API keys!).
- Browser/OS if it's a UI issue.
