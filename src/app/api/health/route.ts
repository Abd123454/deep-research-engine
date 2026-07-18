// Health check endpoint — `GET /api/health`.
//
// Returns a structured status object suitable for Docker HEALTHCHECK,
// uptime monitors, and the desktop wrapper's boot probe. The overall
// `status` is one of:
//   - "ok"        — every check passed (HTTP 200)
//   - "degraded"  — at least one check is degraded, none down (HTTP 200)
//   - "down"      — at least one check is down (HTTP 503)
//
// The `checks` map uses the same vocabulary per-subsystem:
//   - `database` — always present; SQLite or in-memory fallback
//   - `postgres` — only present when DATABASE_URL points at Postgres
//   - `llm`      — at least one provider key/URL configured
//
// Backward-compat fields `uptime` (ms) and `uptimeHuman` are included
// so existing dashboards that read them continue to work.

import { NextResponse } from "next/server";
import { getDb, isPostgresAvailable } from "@/lib/db";
import { env } from "@/lib/env";

const startedAt = Date.now();

export async function GET() {
  const checks: Record<string, "ok" | "degraded" | "down"> = {};

  // Database check (SQLite or in-memory — always present in dev/CI).
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    checks.database = "ok";
  } catch {
    checks.database = "down";
  }

  // Postgres check (if configured). In SQLite mode this key is absent
  // so the response stays small and the overall rollup ignores it.
  if (isPostgresAvailable()) {
    try {
      // Prisma-based check would go here
      checks.postgres = "ok";
    } catch {
      checks.postgres = "degraded";
    }
  }

  // LLM provider check — at least one of the four supported providers
  // must be configured for chat/research/swarm to function.
  const hasNvidia = !!env("NVIDIA_API_KEY");
  const hasOpenAI = !!env("OPENAI_API_KEY");
  const hasAnthropic = !!env("ANTHROPIC_API_KEY");
  const hasOllama = !!env("OLLAMA_URL");
  checks.llm = (hasNvidia || hasOpenAI || hasAnthropic || hasOllama) ? "ok" : "degraded";

  // Overall status.
  const allOk = Object.values(checks).every((s) => s === "ok");
  const anyDown = Object.values(checks).some((s) => s === "down");
  const status = anyDown ? "down" : allOk ? "ok" : "degraded";
  const httpStatus = status === "ok" ? 200 : status === "degraded" ? 200 : 503;

  const uptimeMs = Date.now() - startedAt;

  return NextResponse.json(
    {
      status,
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
      // Backward-compat fields (older dashboards read these).
      uptime: uptimeMs,
      uptimeHuman: `${Math.floor(uptimeMs / 1000)}s`,
    },
    { status: httpStatus },
  );
}
