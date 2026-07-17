// POST /api/auth/mfa/disable — revoke MFA.
//
// Body: { token: string, backupCode?: string }
//
// Requires the user to prove possession of either a current TOTP or a
// backup code before MFA is removed. This prevents an attacker who
// briefly obtains the session from silently weakening the account.
//
// On success, the `user_mfa` row is deleted entirely (secret + backup
// code hashes). Logged as `auth.mfa_disable`.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { disableMfa, getMfaRecord } from "@/lib/mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DisableSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Token must be exactly 6 digits."),
  backupCode: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Backup code must be exactly 8 digits.")
    .optional(),
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

  const parsed = DisableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message || "Invalid input." },
      { status: 400 }
    );
  }

  const rec = getMfaRecord(userId);
  if (!rec || !rec.enabled) {
    return NextResponse.json(
      { ok: false, error: "MFA is not enabled for this account." },
      { status: 400 }
    );
  }

  const ok = disableMfa(userId, parsed.data.token, parsed.data.backupCode);
  if (!ok) {
    logSensitiveAction("auth.mfa_disable", userId, req, {
      phase: "disable_failed",
    });
    return NextResponse.json(
      { ok: false, error: "Invalid TOTP token or backup code." },
      { status: 400 }
    );
  }

  logSensitiveAction("auth.mfa_disable", userId, req, {
    phase: "disabled",
    method: parsed.data.backupCode ? "backup_code" : "totp",
  });
  logger.info({ module: "mfa-disable", userId }, "MFA disabled");

  return NextResponse.json({ ok: true });
}
