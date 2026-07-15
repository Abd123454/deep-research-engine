// Health check endpoint — uses systemHealth() from stability.ts.
// GET /api/health → 200 { status, uptime, version, checks, details }

import { systemHealth } from "@/lib/stability";
import { isDockerAvailable } from "@/lib/code-sandbox-docker";

const startedAt = Date.now();

export async function GET() {
  const uptimeMs = Date.now() - startedAt;
  const health = await systemHealth();
  const dockerAvailable = await isDockerAvailable();

  return Response.json({
    status: health.status, // "healthy" | "degraded" | "unhealthy"
    uptime: uptimeMs,
    uptimeHuman: `${Math.floor(uptimeMs / 1000)}s`,
    version: process.env.npm_package_version || "0.0.0",
    timestamp: new Date().toISOString(),
    checks: {
      ...health.checks,
      docker: dockerAvailable,
    },
    details: health.details,
    // Backward compatible fields.
    redis: health.checks.redis ? "connected" : "not_configured",
    database: health.checks.database ? "connected" : "memory_fallback",
  });
}
