import type { NextConfig } from "next";

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
  },
  async headers() {
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
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
