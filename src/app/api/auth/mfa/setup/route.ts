// POST /api/auth/mfa/setup — begin MFA enrollment.
//
// Generates a fresh TOTP secret + 10 single-use backup codes, stores
// them in `user_mfa` as `enabled=0` (pending), and returns:
//   { ok: true, secret, uri, backupCodes }
//
// The user then:
//   1. Adds the secret to their authenticator app (via QR scan of `uri`
//      or manual entry of `secret`).
//   2. Submits a current 6-digit TOTP to `/api/auth/mfa/verify` to
//      confirm possession and activate MFA.
//
// Backup codes are returned in plaintext EXACTLY ONCE. They are stored
// as SHA-256 hashes; if the user loses them, they must disable and
// re-enroll MFA.
//
// Auth: requires `requireAuth` (401/503 if anonymous in prod).

import { NextRequest, NextResponse } from "next/server";
import { getUserId, requireAuth } from "@/lib/auth";
import { logSensitiveAction } from "@/lib/audit";
import { logger } from "@/lib/logger";
import {
  generateTotpSecret,
  generateTotpUri,
  generateBackupCodes,
  hashBackupCode,
  setPendingMfaSecret,
  isMfaEnabled,
} from "@/lib/mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authFail = requireAuth(req);
  if (authFail) return authFail;

  const userId = getUserId(req);
  // SENSITIVE ACTION: log at the start so even an attempted-but-failed
  // setup is recorded. (Resource: auth.)
  logSensitiveAction("auth.mfa_verify", userId, req, { phase: "setup_initiated" });

  // If MFA is already enabled, refuse re-setup without explicit disable.
  // This prevents an attacker who briefly obtains the session from
  // rotating the secret silently.
  if (isMfaEnabled(userId)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "MFA is already enabled. Disable it first (POST /api/auth/mfa/disable) before re-enrolling.",
      },
      { status: 409 }
    );
  }

  try {
    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes(10);
    const backupCodeHashes = backupCodes.map(hashBackupCode);

    // Stage the pending setup. The previous pending row (if any) is
    // overwritten via the ON CONFLICT clause in setPendingMfaSecret.
    setPendingMfaSecret(userId, secret, backupCodeHashes);

    // The label includes the userId (which is AUTH_USERNAME in
    // multi-tenant mode) so the user can identify the entry in their
    // authenticator app.
    const uri = generateTotpUri(secret, `Quaesitor:${userId}`);

    logger.info(
      { module: "mfa-setup", userId },
      "MFA setup initiated (pending verification)"
    );

    return NextResponse.json({
      ok: true,
      secret,
      uri,
      // Returned once — the front-end should display these to the user
      // with a "save these somewhere safe" warning.
      backupCodes,
      // Friendly hints for QR generators / manual entry.
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
  } catch (err) {
    logger.error(
      {
        module: "mfa-setup",
        userId,
        err: err instanceof Error ? err.message : String(err),
      },
      "MFA setup failed"
    );
    return NextResponse.json(
      { ok: false, error: "Failed to begin MFA enrollment." },
      { status: 500 }
    );
  }
}
