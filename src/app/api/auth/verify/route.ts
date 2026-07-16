// POST /api/auth/verify — verify an email address using a one-time token.
//
// Body: { token: string }
// Returns: 200 { ok: true } if the token is structurally valid; 400 otherwise.
//
// NOTE: This is a placeholder. Real verification requires storing a signed
// token → userId mapping in the database (a `EmailVerificationToken` Prisma
// model is not in scope for this phase). For now we only validate that the
// token is non-empty so the front-end flow can be wired up end-to-end.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestLogger, generateRequestId } from "@/lib/logger";

const VerifySchema = z.object({
  token: z.string().min(1, "Token is required."),
});

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, { module: "auth/verify" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid token." },
      { status: 400 }
    );
  }

  // TODO: look up the token in the DB, mark the user as verified, then delete
  // the token. For now we accept any non-empty token so the front-end flow can
  // be developed in parallel with the DB work.
  log.info({ tokenLen: parsed.data.token.length }, "Email verified (placeholder)");

  return NextResponse.json({ ok: true });
}
