// POST /api/auth/verify — verify an email address using a one-time token.
//
// C-2 (CVSS 9.1): previously this route accepted ANY non-empty token as
// valid, allowing an attacker to bypass email verification by posting
// `{ token: "x" }`. The route now uses the shared `verification-tokens`
// module to mint and consume real signed tokens stored in the
// `verification_tokens` table with expiry (24h) and single-use semantics.
//
// Two request shapes are supported:
//
//   1. POST { email }   — generate a new email-verification token for the
//                          user identified by `email`, store it (24h TTL),
//                          and email it via the `verify-email` template. In
//                          dev mode (RESEND_API_KEY unset) the raw token is
//                          returned in the response so the developer can
//                          paste it into the verify form without a real
//                          email round-trip.
//
//   2. POST { token }   — consume the token (single-use) and mark the
//                          user's `email_verified` column to 1. Returns
//                          200 on success or 400 if the token is invalid /
//                          expired / already used.
//
// The route always returns 200 for the email-generation path (when the
// email is well-formed) to avoid leaking whether the email is registered.

import * as Sentry from "@sentry/nextjs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isPostgresAvailable, getPrismaDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createRequestLogger, generateRequestId } from "@/lib/logger";
import {
  createVerificationToken,
  consumeVerificationToken,
} from "@/lib/verification-tokens";
import type { UserRow } from "@/lib/sqlite-types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const VERIFY_TOKEN_TYPE = "email_verification" as const;

// Either a token (verify path) or an email (generate path). Both being
// present is ambiguous — we prefer `token` because that's the original
// public contract. Neither being present is a 400.
const VerifySchema = z
  .object({
    token: z.string().min(1, "Token is required.").optional(),
    email: z.string().email("Invalid email.").optional(),
  })
  .refine((d) => d.token || d.email, {
    message: "Either `token` or `email` is required.",
  });

interface FoundUser {
  id: string;
  email: string;
  name: string | null;
}

async function findUserByEmail(email: string): Promise<FoundUser | null> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        // Lazily add the email_verified column on Postgres.
        try {
          await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`;
        } catch (err) {
          Sentry.captureException(err);
        }
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

  try {
    const db = getDb();
    // Lazy column add — SQLite ALTER TABLE throws if the column exists.
    try {
      db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
     
    } catch {
      /* column already exists */
    }
    const row = db
      .prepare("SELECT id, email, name FROM users WHERE email = ?")
      .get(email) as Pick<UserRow, "id" | "email" | "name"> | undefined;
    if (row) {
      return { id: row.id, email: row.email, name: row.name };
    }
  } catch (err) {
    Sentry.captureException(err);
  }
  return null;
}

async function markEmailVerified(userId: string): Promise<void> {
  if (isPostgresAvailable()) {
    try {
      const prisma = await getPrismaDb();
      if (prisma) {
        await prisma.$executeRaw`UPDATE users SET email_verified = TRUE WHERE id = ${userId}`;
        return;
      }
    } catch (err) {
      Sentry.captureException(err);
      /* fall through to SQLite */
    }
  }
  try {
    const db = getDb();
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userId);
  } catch (err) {
    Sentry.captureException(err);
  }
}

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
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid request." },
      { status: 400 }
    );
  }

  // ---------- Path 2: verify a token ----------
  if (parsed.data.token) {
    const result = await consumeVerificationToken(
      parsed.data.token,
      VERIFY_TOKEN_TYPE
    );
    if (!result) {
      log.warn({ tokenLen: parsed.data.token.length }, "Invalid or expired verify token");
      return NextResponse.json(
        { ok: false, error: "Invalid or expired verification token." },
        { status: 400 }
      );
    }
    await markEmailVerified(result.userId);
    log.info({ userId: result.userId }, "Email verified");
    return NextResponse.json({ ok: true });
  }

  // ---------- Path 1: generate + send a new token ----------
  // `email` is guaranteed present by the schema refine.
  const email = parsed.data.email!;
  try {
    const user = await findUserByEmail(email);
    if (user) {
      const token = await createVerificationToken(user.id, VERIFY_TOKEN_TYPE);
      const verificationUrl = `${APP_URL}/verify?token=${token}`;
      await sendEmail(user.email, "verify-email", {
        name: user.name || undefined,
        verificationUrl,
      });
      log.info({ userId: user.id }, "Verification email sent");

      // Dev mode: RESEND_API_KEY is unset → sendEmail is a no-op. Return
      // the raw token so the developer can paste it into the verify form.
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
      "Failed to process verify-email request"
    );
  }

  // Always 200 to prevent email enumeration (matches forgot-password).
  return NextResponse.json({ ok: true });
}
