import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Allow large file uploads (documents up to 50MB) via API routes.
  // In Next.js 16, the proxy (middleware) clones the request body before
  // passing it to the route handler. The default clone limit is 10MB —
  // larger bodies are silently truncated, causing formData() to fail with
  // "Expected multipart/form-data". proxyClientMaxBodySize raises that
  // limit. (middlewareClientMaxBodySize is the deprecated name.)
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
    proxyClientMaxBodySize: "50mb",
    // P-1: optimizePackageImports makes Next.js tree-shake the named exports
    // of these large icon/animation/markdown libraries at build time, instead of
    // bundling the entire index. lucide-react alone ships 1k+ icons; without
    // this, every page that imports a single icon pulls the whole module
    // into the dev server's module graph (slower HMR + slower cold start).
    // v5 audit fix #8: added `react-markdown` so its named exports
    // (Components, ComponentProps, etc.) are tree-shaken per-route.
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "framer-motion",
      "react-markdown",
    ],
  },
  // Turbopack needs an explicit project root so its NFT (Node File Trace)
  // does not walk up out of the repo (which previously produced the
  // "Turbopack only supports root: ... at the moment" warning and could
  // pull in unrelated node_modules from parent directories). In Next.js 16
  // this lives at the top level (not under `experimental`).
  turbopack: {
    root: path.join(process.cwd()),
  },
  // better-sqlite3 is a native addon (C++ binding to libsqlite3). Next.js's
  // bundler (Turbopack/Webpack) tries to bundle it, which breaks the native
  // require — causing the /api/sessions route to hang/crash on first
  // compile. serverExternalPackages tells Next.js to leave it as a Node
  // require (loaded at runtime, not bundled). This is the same fix used
  // for any native addon (sharp, bcrypt, etc.) in Next.js.
  serverExternalPackages: ["better-sqlite3", "playwright"],
  // Allow the preview/sandbox environment to load _next/* resources.
  // Without this, the preview iframe gets cross-origin errors.
  allowedDevOrigins: ["*.space-z.ai", "*.z.ai", "localhost", "127.0.0.1"],
  async headers() {
    // Security headers — applied to every route. The CSP is dev-compatible:
    // 'unsafe-inline' + 'unsafe-eval' are required for Next.js dev mode
    // (HMR, fast refresh, eval-based source maps). Production deployments
    // should tighten this further by removing 'unsafe-eval' and using
    // nonces for inline scripts — see the comment on `script-src` below.
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      // Production: 'unsafe-eval' removed. 'unsafe-inline' kept because
      // Next.js still emits some inline style/script tags without nonces
      // (the metadata, the __next_f push chunks). Nonce-based CSP is the
      // eventual goal — see docs/adr for the migration plan.
      : "script-src 'self' 'unsafe-inline'";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      // frame-ancestors 'none' = site cannot be iframed (defense vs.
      // clickjacking). Combined with X-Frame-Options: DENY for legacy
      // browsers that don't honour CSP frame-ancestors.
      "frame-ancestors 'none'",
      // form-action restricted to same-origin by default; Stripe
      // Checkout redirects the browser to checkout.stripe.com so we
      // allow that explicitly.
      "form-action 'self' https://checkout.stripe.com",
      // base-uri locked to 'self' to prevent <base> hijack.
      "base-uri 'self'",
      // object-src 'none' — no Flash/Java/PDF plugins.
      "object-src 'none'",
      // upgrade-insecure-requests — browsers rewrite http:// → https://
      // for same-origin requests.
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        // Apply security headers to all routes.
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // HSTS: 2-year max-age, includeSubDomains, preload-list
            // eligible. (Preload submission to hstspreload.org is a
            // separate operational step — the header is harmless even
            // before submission.)
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Disable source map uploading in dev (no auth configured)
  sourcemaps: { disable: process.env.NODE_ENV !== "production" },
});
