// POST /api/auth/reset-password — set a new password using a reset token.
//
// C-2 (CVSS 9.1): previously this route accepted ANY non-empty token and
// had no way to know WHICH user to update — so an attacker could "reset"
// any account by posting `{ token: "x", password: "new" }` (the route
// returned 200 but didn't actually change anything, since it deferred DB
// work). The route now requires a real single-use reset token from the
// `verification_tokens` table; the token is consumed atomically and the
// associated user's password is hashed and updated in the same flow.

import * as Sentry from "@sentry/nextjs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { createRequestLogger, generateRequestId } from "@/lib/logger";
import { consumeVerificationToken } from "@/lib/verification-tokens";

const RESET_TOKEN_TYPE = "password_reset" as const;

const ResetSchema = z.object({
  token: z.string().min(1, "Token is required."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(200, "Password is too long."),
});

async function updateUserPassword(userId: string, passwordHash: string): Promise<boolean> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const result = await prisma.user.updateMany({
          where: { id: userId },
          data: { passwordHash },
        });
        return result.count > 0;
      }
    } catch (err) {
      Sentry.captureException(err);
      /* fall through to SQLite */
    }
  }
  try {
    const db = getDb();
    const result = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      passwordHash,
      userId
    );
    return result.changes > 0;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

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

  // C-2: consume the token atomically. Returns the userId on success or
  // null if the token is missing, wrong type, expired, or already used.
  const consumed = await consumeVerificationToken(token, RESET_TOKEN_TYPE);
  if (!consumed) {
    log.warn({ tokenLen: token.length }, "Invalid or expired reset token");
    return NextResponse.json(
      { ok: false, error: "Invalid or expired reset token." },
      { status: 400 }
    );
  }

  // Hash the new password (bcrypt, 12 rounds — OWASP recommendation;
  // matches the register route). All new passwords get the upgraded
  // cost factor; existing hashes still at cost 10 are upgraded
  // transparently on next login (see src/app/api/auth/[...nextauth]/route.ts).
  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await updateUserPassword(consumed.userId, passwordHash);
  if (!updated) {
    // The token was valid but the user no longer exists — surface a
    // generic error so we don't leak the existence of the account.
    log.error({ userId: consumed.userId }, "Reset token valid but user not found");
    return NextResponse.json(
      { ok: false, error: "Password reset failed." },
      { status: 500 }
    );
  }

  log.info({ userId: consumed.userId }, "Password reset succeeded");
  return NextResponse.json({ ok: true });
}
