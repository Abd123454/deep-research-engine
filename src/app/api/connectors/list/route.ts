// GET /api/connectors/list — list available + configured connectors.
//
// This is a catalog endpoint: it returns the static catalog of
// supported connectors (Slack / Notion / Drive / GitHub / Jira) plus
// a `configured` flag for each one indicating whether the operator
// has set the required client-id env var on the server.
//
// The endpoint is PUBLIC (no auth required) because the catalog is
// not sensitive — the same info appears in the marketing site. The
// actual connection (storing credentials) is handled by the existing
// POST /api/connectors route, which DOES require auth + project
// ownership verification.
//
// Returns 200 with:
//   {
//     ok: true,
//     connectors: Array<{
//       type: string,
//       name: string,
//       icon: string,
//       description: string,
//       authRequired: boolean,
//       capabilities: string[],
//       configured: boolean   // server-side env var set?
//     }>
//   }
//
// SECURITY: the response never includes credentials, tokens, or
// per-user connection state. It only includes the catalog metadata
// + the `configured` boolean (which is itself non-sensitive — it
// just says "the operator set up the env var"). Per-user connection
// state for a specific project is returned by GET /api/connectors
// (which DOES require auth + ownership verification).

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AVAILABLE_CONNECTORS, getConfiguredConnectors } from "@/lib/connectors";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/sanitize-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Compute the configured set once per request. Cheap (5 env-var
    // lookups) but kept outside the map() for readability.
    const configured = new Set(getConfiguredConnectors());

    return NextResponse.json({
      ok: true,
      connectors: AVAILABLE_CONNECTORS.map((c) => ({
        type: c.type,
        name: c.name,
        icon: c.icon,
        description: c.description,
        authRequired: c.authRequired,
        capabilities: c.capabilities,
        configured: configured.has(c.type),
      })),
    });
  } catch (err) {
    // FB-3 fix: wrap handler body in try/catch to avoid HTTP 500 stack
    // trace leaks if getConfiguredConnectors() or AVAILABLE_CONNECTORS
    // throws (e.g. corrupt connector registry).
    Sentry.captureException(err);
    const safe = sanitizeError(err);
    logger.error({ module: "connectors", err: safe }, "connector list failed");
    return NextResponse.json(
      { ok: false, error: safe || "Failed to list connectors." },
      { status: 500 }
    );
  }
}
