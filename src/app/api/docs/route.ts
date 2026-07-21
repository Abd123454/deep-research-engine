// GET /api/docs — serve the OpenAPI 3.1 spec as YAML.
//
// Point Swagger UI / Redoc / Postman at this URL to get interactive API docs
// for every route in this app. The spec is read from disk on every request
// (small file, no caching needed at this layer — Next.js will cache the
// route itself in production).

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { readFileSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sanitizeError } from "@/lib/sanitize-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  try {
    const specPath = join(process.cwd(), "docs", "api", "openapi.yaml");
    const spec = readFileSync(specPath, "utf-8");
    return new NextResponse(spec, {
      headers: { "Content-Type": "application/yaml" },
    });
  } catch (err) {
    // FB-3 fix: readFileSync throws ENOENT if the OpenAPI spec file is
    // missing (e.g. stripped from the Docker image). Without try/catch
    // the route crashed with a raw 500. Return a clear 404 instead.
    Sentry.captureException(err);
    const safe = sanitizeError(err);
    logger.error({ module: "docs", err: safe }, "OpenAPI spec read failed");
    return NextResponse.json(
      { ok: false, error: "OpenAPI spec not found. Ensure docs/api/openapi.yaml exists." },
      { status: 404 }
    );
  }
}
