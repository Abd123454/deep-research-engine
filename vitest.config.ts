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
  },
  // Prevent Vite from auto-loading postcss.config.mjs (which uses
  // @tailwindcss/postcss — not needed for unit tests and breaks vitest).
  css: {
    postcss: { plugins: [] },
  } as never,
});
