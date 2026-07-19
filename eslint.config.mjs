import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    // A-7: re-enabled as WARNINGS (not errors) so they surface in `bun run
    // lint` output without breaking the build. The codebase has ~125 empty
    // catch blocks and a long tail of `any`/`!` usages; converting all of
    // them in one pass is too risky. Warnings make the debt visible while
    // we incrementally pay it down.
    //
    // no-explicit-any: LLM responses are inherently dynamic; `any` is
    // intentional in those hot paths. Now warned so new uses are conscious.
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    // no-non-null-assertion: `!` is convenient but skips null-checks. Warned
    // so reviewers see them in PRs.
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    // A-7: the base `no-empty` rule (re-enabled as "warn" below) already
    // catches empty catch blocks for both TS and JS code. The
    // @typescript-eslint plugin does NOT ship a separate `no-empty` rule
    // (the audit's suggested name was incorrect). We rely on `no-empty`
    // + `@typescript-eslint/no-empty-function` for full coverage.

    // React rules — exhaustive-deps is critical (prevents stale closures / infinite loops)
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules — re-enabled the ones that catch real bugs
    "prefer-const": "warn",
    "no-unused-vars": "off", // handled by @typescript-eslint rule
    "no-console": "off", // logging is intentional in this project
    "no-debugger": "warn",
    "no-empty": "warn",
    "no-irregular-whitespace": "warn",
    "no-case-declarations": "off",
    "no-fallthrough": "warn",
    "no-mixed-spaces-and-tabs": "warn",
    "no-redeclare": "warn",
    "no-undef": "off", // handled by TS
    "no-unreachable": "warn",
    "no-useless-escape": "warn",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills/**", "mini-services/**", "src/generated/**", "desktop/**", "browser-extension/**", "mobile/**", "tool-results/**", "e2e/**", "playwright.config.ts", "scripts/**"]
}];

export default eslintConfig;
