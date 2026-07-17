// vitest.setup.ts — global test setup.
// Ensures code execution is enabled for all test runs (code-sandbox is
// default-off in production for security, but tests must verify execution works).

process.env.ENABLE_CODE_EXEC = "true";
