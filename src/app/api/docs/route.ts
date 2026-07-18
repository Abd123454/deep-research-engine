// GET /api/docs — serve the OpenAPI 3.1 spec as YAML.
//
// Point Swagger UI / Redoc / Postman at this URL to get interactive API docs
// for every route in this app. The spec is read from disk on every request
// (small file, no caching needed at this layer — Next.js will cache the
// route itself in production).

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const specPath = join(process.cwd(), "docs", "api", "openapi.yaml");
  const spec = readFileSync(specPath, "utf-8");
  return new NextResponse(spec, {
    headers: { "Content-Type": "application/yaml" },
  });
}
