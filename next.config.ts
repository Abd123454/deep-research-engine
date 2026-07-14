import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Allow large file uploads (documents up to 50MB). Without this, Next.js
  // defaults to a 10MB body size limit and silently truncates uploads,
  // causing the formData() parser to fail with "Expected multipart/form-data".
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
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
