// vitest.setup.ts — global test setup.
// Ensures code execution is enabled for all test runs (code-sandbox is
// default-off in production for security, but tests must verify execution works).
// Also marks the environment as "test" so safeFetch skips DNS resolution
// (which would block when fetch is mocked).

process.env.ENABLE_CODE_EXEC = "true";
process.env.VITEST = "true";
// NODE_ENV is set by vitest to "test" automatically — no need to set it here.
