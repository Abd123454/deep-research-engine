// POST /api/auth/reset-password — set a new password using a reset token.
//
// Body: { token: string, password: string }
// Returns: 200 { ok: true } on success; 400 on invalid input.
//
// NOTE: This is a placeholder for token validation. Real validation requires
// a `PasswordResetToken` Prisma model (out of scope for this phase) that maps
// a single-use token → userId with an expiry. For now we accept any non-empty
// token, but we have no way to know WHICH user to update — so password
// updates are deferred until that model lands. The route is wired up so the
// front-end flow can be developed in parallel.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestLogger, generateRequestId } from "@/lib/logger";

const ResetSchema = z.object({
  token: z.string().min(1, "Token is required."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(200, "Password is too long."),
});

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, { module: "auth/reset-password" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid input.",
      },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  // TODO: validate `token` against a `password_reset_tokens` table, look up
  // the userId, check expiry, then hash and update the user's password in a
  // single transaction (and delete the token). For now we log + return 200
  // so the front-end flow can be developed in parallel.
  log.info(
    { tokenLen: token.length, passwordLen: password.length },
    "Password reset requested (placeholder — not persisted)"
  );

  return NextResponse.json({ ok: true });
}
