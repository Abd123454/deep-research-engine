// POST /api/auth/forgot-password — send a password-reset email.
//
// Body: { email: string }
// Returns: 200 always — never leaks whether the email is registered.
//
// If the user exists, generates a single-use reset token and emails it via
// the `password-reset` template. The token itself is NOT stored yet (the
// `PasswordResetToken` Prisma model is out of scope for this phase), so this
// route is effectively a placeholder that exercises the email pipeline. The
// reset link's token is a random UUID the front-end can post back to
// /api/auth/reset-password for shape-validation.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createRequestLogger, generateRequestId } from "@/lib/logger";
import type { UserRow } from "@/lib/sqlite-types";

const ForgotSchema = z.object({
  email: z.string().email("Invalid email."),
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface FoundUser {
  id: string;
  email: string;
  name: string | null;
}

async function findUserByEmail(email: string): Promise<FoundUser | null> {
  // Postgres.
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user && user.email) {
          return { id: user.id, email: user.email, name: user.name };
        }
        return null;
      }
    } catch {
      /* fall through to SQLite */
    }
  }

  // SQLite fallback.
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT id, email, name FROM users WHERE email = ?")
      .get(email) as Pick<UserRow, "id" | "email" | "name"> | undefined;
    if (row) {
      return { id: row.id, email: row.email, name: row.name };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, { module: "auth/forgot-password" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Still 200 — don't leak parse errors.
    return NextResponse.json({ ok: true });
  }

  const parsed = ForgotSchema.safeParse(body);
  if (!parsed.success) {
    // 200 to avoid leaking whether email format is valid vs. registered.
    return NextResponse.json({ ok: true });
  }

  const { email } = parsed.data;

  try {
    const user = await findUserByEmail(email);
    if (user) {
      // TODO: persist this token with an expiry in the DB so
      // /api/auth/reset-password can validate it. For now we just generate a
      // random UUID and send it — the reset-password route treats any
      // non-empty token as valid (placeholder).
      const token = crypto.randomUUID();
      const resetUrl = `${APP_URL}/reset-password?token=${token}`;
      await sendEmail(user.email, "password-reset", {
        name: user.name || undefined,
        resetUrl,
      });
      log.info({ userId: user.id }, "Password reset email sent");
    } else {
      log.info({ email }, "No account found for email — silently skipping");
    }
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to process forgot-password"
    );
  }

  // Always 200 to prevent email enumeration.
  return NextResponse.json({ ok: true });
}
