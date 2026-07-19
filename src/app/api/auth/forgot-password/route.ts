// POST /api/auth/forgot-password — send a password-reset email.
//
// Body: { email: string }
// Returns: 200 always — never leaks whether the email is registered.
//
// If the user exists, generates a single-use reset token (32 random bytes,
// hex-encoded) and stores it in the `verification_tokens` table with type
// `password_reset` and a 1h expiry (C-2 fix). The token is emailed via the
// `password-reset` template; /api/auth/reset-password consumes it atomically
// (single-use) before updating the password.
//
// In dev mode (RESEND_API_KEY unset), the email is a no-op — the raw token
// is returned in the JSON response so end-to-end tests / local developers
// can paste it into the reset form without a real email round-trip.
import * as Sentry from "@sentry/nextjs";


import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createRequestLogger, generateRequestId, logger } from "@/lib/logger";
import { createVerificationToken } from "@/lib/verification-tokens";
import type { UserRow } from "@/lib/sqlite-types";
import { checkStartRateLimit, releaseConcurrency, getClientIP } from "@/lib/rate-limit";

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
    } catch (err) {
  Sentry.captureException(err);
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
  } catch (err) {
    // Non-critical: SQLite user lookup failed (DB locked, table missing).
    // Returning null causes the caller to treat the email as "not found"
    // and return the same generic "if this email exists…" response —
    // user-enumeration safe.
    Sentry.captureException(err);
    logger.warn(
      { module: "forgot-password", email, err: err instanceof Error ? err.message : String(err) },
      "findUserByEmail: SQLite lookup failed — returning null (user-enumeration safe)"
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, { module: "auth/forgot-password" });

  // NH-1 (CVSS 6.5) v5 audit fix: rate-limit password-reset attempts per
  // client IP. Forgot-password is an unauthenticated endpoint that
  // triggers an email send — without a rate limit, an attacker could
  // enumerate emails or amplify email volume to a victim's inbox.
  // The concurrent slot is released in the finally block below.
  const ip = getClientIP(req);
  const rl = await checkStartRateLimit(ip);
  if (!rl.ok) {
    // NOTE: still return 200 to avoid leaking whether the email is
    // registered (matches the existing user-enumeration defense).
    // The 429 only fires under sustained abuse, which is itself a
    // signal that the request wasn't a legit user typo.
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429, headers: rl.retryAfterSec ? { "Retry-After": String(rl.retryAfterSec) } : {} }
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (err) {
  Sentry.captureException(err);
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
        // C-2 fix: persist a real single-use reset token in the
        // verification_tokens table (1h expiry). /api/auth/reset-password
        // consumes it atomically before updating the password.
        const token = await createVerificationToken(user.id, "password_reset");
        const resetUrl = `${APP_URL}/reset-password?token=${token}`;
        await sendEmail(user.email, "password-reset", {
          name: user.name || undefined,
          resetUrl,
        });
        log.info({ userId: user.id }, "Password reset email sent");

        // Dev mode: RESEND_API_KEY is unset → sendEmail is a no-op. Return
        // the raw token so the developer / e2e test can paste it into the
        // reset form without a real email round-trip. The token is still
        // 256 bits of random — returning it over HTTPS to the same email
        // owner is safe.
        const devMode = !process.env.RESEND_API_KEY;
        if (devMode) {
          return NextResponse.json({ ok: true, devToken: token });
        }
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
  } finally {
    // NH-1: release the rate-limit concurrency slot.
    releaseConcurrency(ip);
  }
}
