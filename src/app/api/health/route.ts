// Health check endpoint for Docker / Kubernetes / monitoring.
// GET /api/health → 200 { status, uptime, version, timestamp }

const startedAt = Date.now();

export async function GET() {
  const uptimeMs = Date.now() - startedAt;
  return Response.json({
    status: "ok",
    uptime: uptimeMs,
    uptimeHuman: `${Math.floor(uptimeMs / 1000)}s`,
    version: process.env.npm_package_version || "0.0.0",
    timestamp: new Date().toISOString(),
  });
}
