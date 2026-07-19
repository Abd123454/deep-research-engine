import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load .env + .env.local so smoke tests can access real API keys.
config({ path: ".env.local" });
config({ path: ".env" });

// Tests require code execution to be enabled (the code-sandbox is default-off
// for security in production, but tests assert that run_code actually executes).
process.env.ENABLE_CODE_EXEC = "true";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.test.ts"],
    css: false,
    setupFiles: ["./vitest.setup.ts"],
    // Coverage configuration. Thresholds are only enforced when `--coverage`
    // is passed (i.e. `bun run test:coverage`) — they do NOT affect
    // `bun run test`, which is the gate for every PR + CI run. This lets
    // us ship coverage goals without forcing every dev test-run to also
    // instrument the codebase (instrumentation slows test exec ~30%).
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Reports go to ./coverage/ — already in .gitignore.
      reportsDirectory: "./coverage",
      // Exclude test setup, type definitions, and config files from
      // the coverage report (they're not production code).
      exclude: [
        "node_modules/",
        "dist/",
        ".next/",
        "coverage/",
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.config.ts",
        "**/*.d.ts",
        "vitest.setup.ts",
        "src/types/**",
      ],
      thresholds: {
        // Floor — prevents catastrophic coverage regressions. The
        // current codebase is well above these (see `bun run test:coverage`
        // output for actual numbers). Tighten in future passes.
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
  // Prevent Vite from auto-loading postcss.config.mjs (which uses
  // @tailwindcss/postcss — not needed for unit tests and breaks vitest).
  css: {
    postcss: { plugins: [] },
  } as never,
});
