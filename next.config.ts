import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // NOTE: ignoreBuildErrors was previously `true`, which silently let TypeScript
  // errors ship to production. It is now removed so that `next build` fails on
  // any type error — this restores the value of TypeScript.
  reactStrictMode: true,
};

export default nextConfig;
