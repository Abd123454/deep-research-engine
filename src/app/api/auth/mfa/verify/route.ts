// POST /api/auth/mfa/verify — complete MFA enrollment.
//
// Body: { token: string }  (6-digit TOTP from the user's authenticator)
//
// Verifies the token against the PENDING secret stored by /setup. On
// success, marks the MFA record as `enabled=1`. On failure, returns
// 400 without revealing whether the pending setup exists (to avoid
// leaking which userIds have begun enrollment).
//
// Auth: requires `requireAuth`. Logged as `auth.mfa_enable` on success
// (the moment MFA actually becomes active for the account).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { enableMfa, getMfaRecord } from "@/lib/mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VerifySchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Token must be exactly 6 digits."),
});

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);

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

  const rec = getMfaRecord(userId);
  if (!rec || rec.enabled) {
    // No pending setup, or MFA already enabled. Return a generic 400
    // to avoid leaking which userIds have pending setups.
    return NextResponse.json(
      { ok: false, error: "No pending MFA setup found. Call /api/auth/mfa/setup first." },
      { status: 400 }
    );
  }

  const ok = enableMfa(userId, parsed.data.token);
  if (!ok) {
    // SENSITIVE ACTION: log the failed verification attempt so brute-
    // force patterns are detectable. (Resource: auth.)
    logSensitiveAction("auth.mfa_verify", userId, req, {
      phase: "verify_failed",
    });
    return NextResponse.json(
      { ok: false, error: "Invalid TOTP token. Try again." },
      { status: 400 }
    );
  }

  // SENSITIVE ACTION: MFA is now active — this is the moment that
  // counts as "auth.mfa_enable".
  logSensitiveAction("auth.mfa_enable", userId, req, { phase: "enabled" });
  logger.info({ module: "mfa-verify", userId }, "MFA enabled");

  return NextResponse.json({ ok: true });
}
