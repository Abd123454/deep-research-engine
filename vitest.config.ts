import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.test.ts"],
    css: false,
  },
  // Prevent Vite from auto-loading postcss.config.mjs (which uses
  // @tailwindcss/postcss — not needed for unit tests and breaks vitest).
  css: {
    postcss: { plugins: [] },
  } as never,
});
